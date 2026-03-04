import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card, Col, Row, Space, Statistic, Tag, Typography, Spin, Empty, Button, Table, Tabs, Input,
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
} from '@ant-design/icons';
import { progressService, CharacterProfile } from '../services/progress.service';
import { dofusdbService, levelRange } from '../services/dofusdb.service';
import { ClassAvatar } from '../components/character/ClassAvatar';
import type { Dungeon } from '../types/dofusdb';

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

function QuestTypeTag({ quest }: { quest: QuestStub }) {
  if (quest.isDungeonQuest) return <Tag color="volcano" icon={<ThunderboltOutlined />}>Donjon</Tag>;
  if (quest.isPartyQuest) return <Tag color="purple">Groupe</Tag>;
  if (quest.isEvent) return <Tag color="cyan">Événement</Tag>;
  return <Tag>Normale</Tag>;
}

function buildColumns(catNames: Record<number, string>, quests: QuestStub[]): ColumnsType<QuestStub> {
  const catSet = [...new Set(quests.map((q) => q.categoryId))];
  const catFilters = catSet
    .map((id) => ({ text: catNames[id] ?? `#${id}`, value: id }))
    .sort((a, b) => a.text.localeCompare(b.text));

  return [
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
  ];
}

export function ProfilePage() {
  const { characterId } = useParams<{ characterId: string }>();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<CharacterProfile | null>(null);
  const [blockedQuests, setBlockedQuests] = useState<QuestStub[]>([]);
  const [startedQuests, setStartedQuests] = useState<QuestStub[]>([]);
  const [catNames, setCatNames] = useState<Record<number, string>>({});
  const [allDungeons, setAllDungeons] = useState<Dungeon[]>([]);
  const [loading, setLoading] = useState(true);
  const [questsLoading, setQuestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!characterId) return;
    setLoading(true);
    setError(null);
    Promise.all([
      progressService.getProfile(characterId),
      dofusdbService.getAllQuestCategories(),
      dofusdbService.getAllDungeons(),
    ])
      .then(async ([data, cats, dungeons]) => {
        setProfile(data);
        setAllDungeons(dungeons);
        const m: Record<number, string> = {};
        cats.forEach((c) => { m[c.id] = c.name.fr; });
        setCatNames(m);

        const idsToFetch = [
          ...(data.blockedQuestIds.length > 0 ? data.blockedQuestIds : []),
          ...(data.startedQuestIds.length > 0 ? data.startedQuestIds : []),
        ];
        if (idsToFetch.length > 0) {
          setQuestsLoading(true);
          const allQuests = await dofusdbService.getQuestsByIds(
            [...new Set(idsToFetch)],
          );
          const questMap = new Map(allQuests.map((q) => [q.id, q as QuestStub]));
          setBlockedQuests(data.blockedQuestIds.map((id) => questMap.get(id)).filter(Boolean) as QuestStub[]);
          setStartedQuests(data.startedQuestIds.map((id) => questMap.get(id)).filter(Boolean) as QuestStub[]);
          setQuestsLoading(false);
        }
      })
      .catch(() => setError('Personnage introuvable.'))
      .finally(() => setLoading(false));
  }, [characterId]);

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
  const blockedCols = buildColumns(catNames, blockedQuests);
  const startedCols = buildColumns(catNames, startedQuests);

  const dungeonMap = new Map(allDungeons.map((d) => [d.id, d]));
  const todoDungeons = (profile.todoDungeonIds ?? []).map((id) => dungeonMap.get(id)).filter(Boolean) as Dungeon[];

  const dungeonColumns: ColumnsType<Dungeon> = [
    {
      title: 'Donjon',
      dataIndex: ['name', 'fr'],
      sorter: (a, b) => a.name.fr.localeCompare(b.name.fr),
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
          <Space size="large" align="center">
            <ClassAvatar className={character.class} size={72} />
            <div>
              <Title level={2} style={{ margin: 0 }}>{character.name}</Title>
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
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {profile.totalPoints} pts
                  </Text>
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
    </div>
  );
}
