import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card, Col, Row, Space, Statistic, Tag, Typography, Spin, Empty, Button, Table, Tabs, Input,
  Select, Popover, Badge, Modal, List, Tooltip, message,
} from 'antd';
import type { ColumnsType, FilterDropdownProps } from 'antd/es/table/interface';
import {
  TeamOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
  SearchOutlined,
  CompassOutlined,
  CommentOutlined,
  BookFilled,
  CheckCircleFilled,
  EditOutlined,
} from '@ant-design/icons';
import { progressService, CharacterProfile, QuestStatus } from '../services/progress.service';
import { dofusdbService, levelRange } from '../services/dofusdb.service';
import { ClassAvatar } from '../components/character/ClassAvatar';
import { CharacterFormModal } from '../components/character/CharacterFormModal';
import { useCharacterStore } from '../stores/characterStore';
import type { Dungeon } from '../types/dofusdb';
import { AxiosError } from 'axios';

const { Title, Text } = Typography;

type QuestStub = {
  id: number;
  name: { fr: string };
  categoryId: number;
  levelMin: number;
  levelMax: number;
  isDungeonQuest: boolean;
  isPartyQuest: boolean;
  isEvent: boolean;
};

const STATUS_OPTIONS: { label: string; value: QuestStatus; color: string }[] = [
  { label: 'À faire',  value: 'todo',      color: 'default' },
  { label: 'En cours', value: 'started',   color: 'blue' },
  { label: 'Bloquée',  value: 'blocked',   color: 'red' },
  { label: 'Terminée', value: 'completed', color: 'green' },
];

function QuestTypeTag({ quest }: { quest: QuestStub }) {
  if (quest.isDungeonQuest) return <Tag color="volcano" icon={<ThunderboltOutlined />}>Donjon</Tag>;
  if (quest.isPartyQuest) return <Tag color="purple">Groupe</Tag>;
  if (quest.isEvent) return <Tag color="cyan">Événement</Tag>;
  return <Tag>Normale</Tag>;
}

function CommentPopover({
  value,
  onSave,
  disabled,
}: {
  value: string | undefined;
  onSave: (comment: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(value ?? '');
        setOpen(o);
      }}
      trigger="click"
      title="Commentaire"
      content={
        <div style={{ width: 260 }}>
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ajouter un commentaire..."
            autoSize={{ minRows: 2, maxRows: 5 }}
            style={{ marginBottom: 8 }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button size="small" onClick={() => setOpen(false)}>Annuler</Button>
            <Button
              size="small"
              type="primary"
              style={{ background: '#c0902b', borderColor: '#c0902b' }}
              onClick={() => { onSave(draft); setOpen(false); }}
            >
              OK
            </Button>
          </div>
        </div>
      }
    >
      <Badge dot={!!value} color="#c0902b" offset={[-2, 2]}>
        <Button
          size="small"
          type="text"
          disabled={disabled}
          icon={<CommentOutlined />}
          style={{ color: value ? '#c0902b' : '#8c8c8c' }}
        />
      </Badge>
    </Popover>
  );
}

export function ProfilePage() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();
  const { characters, managedCharacters, classes, fetchClasses, updateCharacter, fetchCharacters } = useCharacterStore();

  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [blockedQuests, setBlockedQuests] = useState<QuestStub[]>([]);
  const [startedQuests, setStartedQuests] = useState<QuestStub[]>([]);
  const [catNames, setCatNames] = useState<Record<number, string>>({});
  const [allDungeons, setAllDungeons] = useState<Dungeon[]>([]);
  const [loading, setLoading] = useState(true);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  const ownedCharacter = useMemo(
    () => (characterId ? characters.find((c) => c.id === characterId) ?? null : null),
    [characterId, characters],
  );

  useEffect(() => {
    if (ownedCharacter && classes.length === 0) fetchClasses();
  }, [ownedCharacter, classes.length, fetchClasses]);

  const handleEditCharacter = async (data: { name: string; characterClass: string; level: number }) => {
    if (!characterId) return;
    try {
      await updateCharacter(characterId, data);
      message.success('Personnage modifié');
      setEditModalOpen(false);
      await loadProfile();
      await fetchCharacters();
    } catch (err) {
      message.error(err instanceof AxiosError ? err.response?.data?.error : 'Erreur');
    }
  };

  const canEdit = useMemo(() => {
    if (!characterId) return false;
    return (
      characters.some((c) => c.id === characterId) ||
      managedCharacters.some((c) => c.id === characterId)
    );
  }, [characterId, characters, managedCharacters]);

  const isManaged = useMemo(
    () => !!characterId && managedCharacters.some((c) => c.id === characterId),
    [characterId, managedCharacters],
  );

  const loadProfile = useCallback(async () => {
    if (!characterId) return;
    const data = await progressService.getProfile(characterId);
    setProfile(data);
    const idsToFetch = [...new Set([...data.blockedQuestIds, ...data.startedQuestIds])];
    if (idsToFetch.length > 0) {
      setQuestsLoading(true);
      const allQuests = await dofusdbService.getQuestsByIds(idsToFetch);
      const questMap = new Map(allQuests.map((q) => [q.id, q as QuestStub]));
      setBlockedQuests(data.blockedQuestIds.map((id) => questMap.get(id)).filter(Boolean) as QuestStub[]);
      setStartedQuests(data.startedQuestIds.map((id) => questMap.get(id)).filter(Boolean) as QuestStub[]);
      setQuestsLoading(false);
    } else {
      setBlockedQuests([]);
      setStartedQuests([]);
    }
  }, [characterId]);

  useEffect(() => {
    if (!characterId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      dofusdbService.getAllQuestCategories(),
      dofusdbService.getAllDungeons(),
      loadProfile(),
    ])
      .then(([cats, dungeons]) => {
        setAllDungeons(dungeons);
        const m: Record<number, string> = {};
        cats.forEach((c) => { m[c.id] = c.name.fr; });
        setCatNames(m);
      })
      .catch(() => setError('Personnage introuvable.'))
      .finally(() => setLoading(false));
  }, [characterId, loadProfile]);

  const handleQuestStatus = async (questId: number, status: QuestStatus, comment?: string) => {
    if (!characterId) return;
    try {
      await progressService.setQuestStatus(characterId, questId, status, comment);
      await loadProfile();
    } catch {
      message.error('Échec de la mise à jour');
    }
  };

  const handleQuestComment = async (questId: number, status: QuestStatus, comment: string) => {
    await handleQuestStatus(questId, status, comment);
  };

  const handleDungeonToggle = async (dungeonId: number, flag: 'isTodo' | 'isDone') => {
    if (!characterId || !profile) return;
    const currentTodo = profile.todoDungeonIds.includes(dungeonId);
    const currentDone = profile.doneDungeonIds.includes(dungeonId);
    const next = flag === 'isTodo' ? { isTodo: !currentTodo } : { isDone: !currentDone };
    try {
      await progressService.setDungeonStatus(characterId, dungeonId, next);
      await loadProfile();
    } catch {
      message.error('Échec de la mise à jour');
    }
  };

  const handleDungeonComment = async (dungeonId: number, comment: string) => {
    if (!characterId) return;
    try {
      await progressService.setDungeonStatus(characterId, dungeonId, { comment });
      await loadProfile();
    } catch {
      message.error('Échec de la mise à jour');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description={error ?? 'Personnage introuvable'}>
          <Button onClick={() => navigate(-1)}>Retour</Button>
        </Empty>
      </div>
    );
  }

  const { character } = profile;

  const buildQuestColumns = (quests: QuestStub[]): ColumnsType<QuestStub> => {
    const catSet = [...new Set(quests.map((q) => q.categoryId))];
    const catFilters = catSet
      .map((id) => ({ text: catNames[id] ?? `#${id}`, value: id }))
      .sort((a, b) => a.text.localeCompare(b.text));

    const cols: ColumnsType<QuestStub> = [];

    if (canEdit) {
      cols.push({
        title: 'Statut',
        key: 'status',
        width: 130,
        render: (_, r) => {
          const status: QuestStatus = profile.completedQuestIds.includes(r.id) ? 'completed'
            : profile.startedQuestIds.includes(r.id) ? 'started'
            : profile.blockedQuestIds.includes(r.id) ? 'blocked'
            : 'todo';
          return (
            <Select
              size="small"
              value={status}
              style={{ width: 120 }}
              onChange={(s) => handleQuestStatus(r.id, s)}
              options={STATUS_OPTIONS.map((o) => ({
                value: o.value,
                label: <Tag color={o.color} style={{ margin: 0, fontSize: 11 }}>{o.label}</Tag>,
              }))}
            />
          );
        },
      });
    }

    cols.push(
      {
        title: 'Quête',
        dataIndex: ['name', 'fr'],
        sorter: (a, b) => a.name.fr.localeCompare(b.name.fr),
        filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
          <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
            <Input
              autoFocus
              placeholder="Rechercher..."
              value={selectedKeys[0] as string}
              onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
              onPressEnter={() => confirm()}
              style={{ width: 220, marginBottom: 8, display: 'block' }}
            />
            <Space>
              <Button type="primary" onClick={() => confirm()} size="small" icon={<SearchOutlined />}>Filtrer</Button>
              <Button onClick={() => { clearFilters?.(); confirm(); }} size="small">Effacer</Button>
            </Space>
          </div>
        ),
        filterIcon: (filtered: boolean) => <SearchOutlined style={{ color: filtered ? '#1677ff' : undefined }} />,
        onFilter: (value, record) =>
          record.name.fr.toLowerCase().includes((value as string).toLowerCase()),
      },
      {
        title: 'Catégorie',
        key: 'category',
        sorter: (a, b) => (catNames[a.categoryId] ?? '').localeCompare(catNames[b.categoryId] ?? ''),
        filters: catFilters,
        onFilter: (value, record) => record.categoryId === value,
        render: (_, r) => (
          <Text style={{ fontSize: 12 }}>{catNames[r.categoryId] ?? `#${r.categoryId}`}</Text>
        ),
      },
      {
        title: 'Niveau',
        key: 'level',
        width: 110,
        sorter: (a, b) => (a.levelMin || 0) - (b.levelMin || 0),
        render: (_, r) => levelRange(r.levelMin, r.levelMax) ? (
          <Tag color="orange" style={{ fontSize: 11 }}>{levelRange(r.levelMin, r.levelMax)}</Tag>
        ) : '—',
      },
      {
        title: 'Type',
        key: 'type',
        width: 120,
        filters: [
          { text: 'Donjon', value: 'dungeon' },
          { text: 'Groupe', value: 'party' },
          { text: 'Événement', value: 'event' },
          { text: 'Normale', value: 'normal' },
        ],
        onFilter: (value, record) => {
          if (value === 'dungeon') return record.isDungeonQuest;
          if (value === 'party') return record.isPartyQuest;
          if (value === 'event') return record.isEvent;
          return !record.isDungeonQuest && !record.isPartyQuest && !record.isEvent;
        },
        render: (_, r) => <QuestTypeTag quest={r} />,
      },
      {
        title: 'Commentaire',
        key: 'comment',
        render: (_, r) => {
          const c = profile.questComments?.[r.id];
          if (canEdit) {
            const status: QuestStatus = profile.completedQuestIds.includes(r.id) ? 'completed'
              : profile.startedQuestIds.includes(r.id) ? 'started'
              : profile.blockedQuestIds.includes(r.id) ? 'blocked'
              : 'todo';
            return (
              <Space size={4}>
                {c && <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: c }}>{c}</Text>}
                <CommentPopover
                  value={c}
                  onSave={(comment) => handleQuestComment(r.id, status, comment)}
                />
              </Space>
            );
          }
          return c ? <Text style={{ fontSize: 12 }}>{c}</Text> : <Text type="secondary">—</Text>;
        },
      },
    );
    return cols;
  };

  const blockedCols = buildQuestColumns(blockedQuests);
  const startedCols = buildQuestColumns(startedQuests);

  const dungeonMap = new Map(allDungeons.map((d) => [d.id, d]));
  const todoDungeons = (profile.todoDungeonIds ?? []).map((id) => dungeonMap.get(id)).filter(Boolean) as Dungeon[];

  const dungeonColumns: ColumnsType<Dungeon> = [
    {
      title: 'Donjon',
      dataIndex: ['name', 'fr'],
      sorter: (a, b) => a.name.fr.localeCompare(b.name.fr),
    },
    ...(canEdit
      ? [{
          title: 'Statut',
          key: 'status',
          width: 100,
          render: (_: unknown, r: Dungeon) => {
            const isTodo = profile.todoDungeonIds.includes(r.id);
            const isDone = profile.doneDungeonIds.includes(r.id);
            return (
              <Space size={2}>
                <Tooltip title={isTodo ? 'Retirer "à faire"' : 'Marquer "à faire"'}>
                  <Button
                    type="text"
                    size="small"
                    icon={<BookFilled style={{ color: isTodo ? '#c0902b' : '#d9d9d9' }} />}
                    onClick={() => handleDungeonToggle(r.id, 'isTodo')}
                  />
                </Tooltip>
                <Tooltip title={isDone ? 'Retirer "fait"' : 'Marquer "fait"'}>
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckCircleFilled style={{ color: isDone ? '#52c41a' : '#d9d9d9' }} />}
                    onClick={() => handleDungeonToggle(r.id, 'isDone')}
                  />
                </Tooltip>
              </Space>
            );
          },
        } as ColumnsType<Dungeon>[number]]
      : []),
    {
      title: 'Commentaire',
      key: 'comment',
      render: (_, r) => {
        const c = (profile.dungeonComments ?? {})[r.id];
        if (canEdit) {
          return (
            <Space size={4}>
              {c && <Text style={{ fontSize: 12 }} ellipsis={{ tooltip: c }}>{c}</Text>}
              <CommentPopover value={c} onSave={(comment) => handleDungeonComment(r.id, comment)} />
            </Space>
          );
        }
        return c ? <Text style={{ fontSize: 12 }}>{c}</Text> : <Text type="secondary">—</Text>;
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate(-1)}>
          Retour
        </Button>

        {/* Header */}
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <Space size="large" align="center">
              <ClassAvatar className={character.class} size={72} />
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  {character.name}
                  {isManaged && (
                    <Tag color="gold" icon={<TeamOutlined />} style={{ marginLeft: 12, fontSize: 12 }}>
                      Membre de ma guilde
                    </Tag>
                  )}
                </Title>
                <Space size={8} style={{ marginTop: 4 }}>
                  <Tag color="orange" style={{ fontSize: 13 }}>{character.class}</Tag>
                  <Tag style={{ fontSize: 13 }}>Niv. {character.level}</Tag>
                  {character.guild && (
                    <Link to="/guild">
                      <Tag icon={<TeamOutlined />} color="blue" style={{ fontSize: 13, cursor: 'pointer' }}>
                        {character.guild.name}
                      </Tag>
                    </Link>
                  )}
                </Space>
              </div>
            </Space>
            <Space>
              {ownedCharacter && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setEditModalOpen(true)}
                >
                  Modifier le personnage
                </Button>
              )}
              {canEdit && (
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setSearchModalOpen(true)}
                  style={{ borderColor: '#c0902b', color: '#c0902b' }}
                >
                  Modifier une quête par nom
                </Button>
              )}
            </Space>
          </div>
        </Card>

        {/* Stats */}
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Succès"
                value={profile.completedAchievementIds.length}
                prefix={<TrophyOutlined />}
                suffix={
                  <Text type="secondary" style={{ fontSize: 12 }}>{profile.totalPoints} pts</Text>
                }
                valueStyle={{ color: '#c0902b' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Quêtes terminées"
                value={profile.completedQuestIds.length}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="En cours"
                value={profile.startedQuestIds.length}
                prefix={<ClockCircleOutlined />}
                valueStyle={{ color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card>
              <Statistic
                title="Bloquées"
                value={profile.blockedQuestIds.length}
                prefix={<StopOutlined />}
                valueStyle={{ color: profile.blockedQuestIds.length > 0 ? '#ff4d4f' : undefined }}
              />
            </Card>
          </Col>
        </Row>

        {/* Tabs quêtes + donjons */}
        <Card bodyStyle={{ padding: 0 }}>
          <Tabs
            defaultActiveKey="blocked"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'blocked',
                label: (
                  <Space size={6}>
                    <StopOutlined style={{ color: '#ff4d4f' }} />
                    <span>Bloquées</span>
                    <Tag color="red" style={{ marginLeft: 0 }}>{profile.blockedQuestIds.length}</Tag>
                  </Space>
                ),
                children: (
                  <Table<QuestStub>
                    dataSource={blockedQuests}
                    columns={blockedCols}
                    rowKey="id"
                    loading={questsLoading}
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} quêtes` }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune quête bloquée" /> }}
                    style={{ marginTop: 8 }}
                  />
                ),
              },
              {
                key: 'started',
                label: (
                  <Space size={6}>
                    <ClockCircleOutlined style={{ color: '#1677ff' }} />
                    <span>En cours</span>
                    <Tag color="blue" style={{ marginLeft: 0 }}>{profile.startedQuestIds.length}</Tag>
                  </Space>
                ),
                children: (
                  <Table<QuestStub>
                    dataSource={startedQuests}
                    columns={startedCols}
                    rowKey="id"
                    loading={questsLoading}
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} quêtes` }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune quête en cours" /> }}
                    style={{ marginTop: 8 }}
                  />
                ),
              },
              {
                key: 'dungeons',
                label: (
                  <Space size={6}>
                    <CompassOutlined style={{ color: '#c0902b' }} />
                    <span>Donjons à faire</span>
                    <Tag color="orange" style={{ marginLeft: 0 }}>{todoDungeons.length}</Tag>
                  </Space>
                ),
                children: (
                  <Table<Dungeon>
                    dataSource={todoDungeons}
                    columns={dungeonColumns}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} donjons` }}
                    locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun donjon à faire" /> }}
                    style={{ marginTop: 8 }}
                  />
                ),
              },
            ]}
          />
        </Card>
      </Space>

      {/* Modale édition personnage */}
      {ownedCharacter && (
        <CharacterFormModal
          open={editModalOpen}
          character={ownedCharacter}
          classes={classes}
          onSubmit={handleEditCharacter}
          onCancel={() => setEditModalOpen(false)}
        />
      )}

      {/* Modale recherche quête par nom */}
      <QuestSearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        profile={profile}
        catNames={catNames}
        onSetStatus={handleQuestStatus}
      />
    </div>
  );
}

function QuestSearchModal({
  open,
  onClose,
  profile,
  catNames,
  onSetStatus,
}: {
  open: boolean;
  onClose: () => void;
  profile: CharacterProfile;
  catNames: Record<number, string>;
  onSetStatus: (questId: number, status: QuestStatus) => Promise<void>;
}) {
  const [allQuests, setAllQuests] = useState<QuestStub[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    if (allQuests.length > 0) return;
    setLoading(true);
    dofusdbService.getAllQuests()
      .then((qs) => setAllQuests(qs as QuestStub[]))
      .finally(() => setLoading(false));
  }, [open, allQuests.length]);

  const filtered = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allQuests
      .filter((quest) => quest.name.fr.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allQuests, search]);

  const getStatus = (questId: number): QuestStatus => {
    if (profile.completedQuestIds.includes(questId)) return 'completed';
    if (profile.startedQuestIds.includes(questId)) return 'started';
    if (profile.blockedQuestIds.includes(questId)) return 'blocked';
    return 'todo';
  };

  return (
    <Modal
      title="Modifier une quête par nom"
      open={open}
      onCancel={onClose}
      footer={<Button onClick={onClose}>Fermer</Button>}
      width={720}
    >
      <Input
        autoFocus
        placeholder="Tapez le nom d'une quête..."
        prefix={<SearchOutlined />}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
      />
      <div style={{ marginTop: 12, maxHeight: 480, overflow: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
        ) : !search.trim() ? (
          <Empty description="Tapez un nom pour rechercher" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : filtered.length === 0 ? (
          <Empty description="Aucune quête trouvée" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <List
            size="small"
            dataSource={filtered}
            renderItem={(quest) => {
              const status = getStatus(quest.id);
              return (
                <List.Item style={{ padding: '8px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10 }}>
                    <Select
                      size="small"
                      value={status}
                      style={{ width: 120, flexShrink: 0 }}
                      onChange={(s) => onSetStatus(quest.id, s)}
                      options={STATUS_OPTIONS.map((o) => ({
                        value: o.value,
                        label: <Tag color={o.color} style={{ margin: 0, fontSize: 11 }}>{o.label}</Tag>,
                      }))}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong ellipsis={{ tooltip: quest.name.fr }}>{quest.name.fr}</Text>
                      <div style={{ marginTop: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {catNames[quest.categoryId] ?? `#${quest.categoryId}`}
                        </Text>
                        {levelRange(quest.levelMin, quest.levelMax) && (
                          <Tag color="orange" style={{ fontSize: 10, margin: 0 }}>
                            {levelRange(quest.levelMin, quest.levelMax)}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </div>
                </List.Item>
              );
            }}
          />
        )}
      </div>
    </Modal>
  );
}
