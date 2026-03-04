import { useEffect, useState } from 'react';
import { Card, Button, Typography, Space, Avatar, Tag, Empty, Spin, message, Tooltip, Table, Input, List, theme } from 'antd';
import type { ColumnsType, FilterDropdownProps } from 'antd/es/table/interface';
import {
  TeamOutlined, PlusOutlined, UserAddOutlined, CrownOutlined, BookOutlined,
  StopOutlined, ThunderboltOutlined, MailOutlined, CheckOutlined, CloseOutlined, SearchOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { useGuildStore } from '../stores/guildStore';
import { GuildFormModal } from '../components/guild/GuildFormModal';
import { MemberList } from '../components/guild/MemberList';
import { InviteModal } from '../components/guild/InviteModal';
import { CreateGuildData } from '../types';
import { AxiosError } from 'axios';
import { progressService, GuildMemberProgress } from '../services/progress.service';
import { dofusdbService, levelRange } from '../services/dofusdb.service';

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

type TopBlockedQuest = {
  questId: number;
  memberCount: number;
  memberNames: string[];
  quest: QuestStub | null;
};

export function GuildPage() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const { characters, fetchCharacters } = useCharacterStore();
  const { guild, members, fetchGuild, createGuild, inviteCharacter, removeMember, invitations, fetchInvitations, acceptInvitation, declineInvitation } = useGuildStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Guild progress
  const [guildProgress, setGuildProgress] = useState<GuildMemberProgress[]>([]);

  // Top blocked quests (fetched)
  const [topBlocked, setTopBlocked] = useState<TopBlockedQuest[]>([]);
  const [topBlockedLoading, setTopBlockedLoading] = useState(false);

  // Category names map
  const [catNames, setCatNames] = useState<Record<number, string>>({});

  useEffect(() => {
    fetchCharacters();
    fetchInvitations();
    dofusdbService.getAllQuestCategories().then((cats) => {
      const m: Record<number, string> = {};
      cats.forEach((c) => { m[c.id] = c.name.fr; });
      setCatNames(m);
    }).catch(() => {});
  }, [fetchCharacters, fetchInvitations]);

  // Find the first character in a guild
  const characterInGuild = characters.find((c) => c.guildMember);
  const guildId = characterInGuild?.guildMember?.guildId;

  useEffect(() => {
    if (guildId) fetchGuild(guildId);
  }, [guildId, fetchGuild]);

  useEffect(() => {
    if (!guildId) return;
    progressService.getGuildProgress(guildId).then(async ({ members: progressMembers }) => {
      setGuildProgress(progressMembers);

      // Compute top blocked quests
      const questCount: Record<number, { count: number; names: string[] }> = {};
      progressMembers.forEach((mp) => {
        (mp.blockedQuestIds ?? []).forEach((qid) => {
          if (!questCount[qid]) questCount[qid] = { count: 0, names: [] };
          questCount[qid].count++;
          questCount[qid].names.push(mp.name);
        });
      });

      const sorted = Object.entries(questCount)
        .map(([qid, { count, names }]) => ({ questId: Number(qid), memberCount: count, memberNames: names }))
        .sort((a, b) => b.memberCount - a.memberCount)
        .slice(0, 15);

      if (sorted.length > 0) {
        setTopBlockedLoading(true);
        const questData = await dofusdbService.getQuestsByIds(sorted.map((s) => s.questId));
        const questMap: Record<number, QuestStub> = {};
        questData.forEach((q) => { questMap[q.id] = q; });
        setTopBlocked(sorted.map((s) => ({ ...s, quest: questMap[s.questId] ?? null })));
        setTopBlockedLoading(false);
      } else {
        setTopBlocked([]);
      }
    }).catch(() => {});
  }, [guildId]);

  const eligibleCharacters = characters.filter((c) => !c.guildMember);

  // Current user's member role in this guild
  const myMember = members.find((m) =>
    characters.some((c) => c.id === m.characterId),
  );
  const canManage = myMember?.role === 'leader' || myMember?.role === 'officer';

  // Activité commune : catégories où 2+ membres ont des quêtes EN COURS ou BLOQUÉES
  const sharedActivity = (() => {
    const catMemberCount: Record<number, Set<string>> = {};
    guildProgress.forEach((mp) => {
      const cats = new Set([
        ...Object.keys(mp.startedQuestCategoryProgress ?? {}),
        ...Object.keys(mp.blockedQuestCategoryProgress ?? {}),
      ]);
      cats.forEach((catId) => {
        const id = Number(catId);
        if (!catMemberCount[id]) catMemberCount[id] = new Set();
        catMemberCount[id].add(mp.characterId);
      });
    });
    return Object.entries(catMemberCount)
      .filter(([, m]) => m.size >= 2)
      .map(([catId, memberSet]) => ({ catId: Number(catId), memberCount: memberSet.size }))
      .sort((a, b) => b.memberCount - a.memberCount)
      .slice(0, 10);
  })();

  const handleCreateGuild = async (data: CreateGuildData) => {
    try {
      const created = await createGuild(data);
      message.success('Guilde créée !');
      setCreateModalOpen(false);
      fetchGuild(created.id);
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleInvite = async (characterName: string) => {
    if (!guildId) return;
    try {
      await inviteCharacter(guildId, characterName);
      message.success('Invitation envoyée !');
      setInviteModalOpen(false);
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleRemoveMember = async (characterId: string) => {
    if (!guildId) return;
    try {
      await removeMember(guildId, characterId);
      message.success('Membre retiré');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleMemberClick = (characterId: string) => {
    navigate(`/profile/${characterId}`);
  };

  const handleAcceptInvitation = async (token: string, guildName: string) => {
    try {
      await acceptInvitation(token);
      await fetchCharacters();
      message.success(`Vous avez rejoint ${guildName} !`);
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleDeclineInvitation = async (token: string) => {
    try {
      await declineInvitation(token);
      message.info('Invitation refusée');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  if (!characterInGuild) {
    return (
      <div style={{ padding: 24 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ margin: 0 }}>Guilde</Title>

          {invitations.length > 0 && (
            <Card
              title={
                <Space>
                  <MailOutlined style={{ color: '#c0902b' }} />
                  <span>Invitations en attente ({invitations.length})</span>
                </Space>
              }
            >
              <List
                dataSource={invitations}
                renderItem={(inv) => (
                  <List.Item>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                      {inv.guild.imageUrl ? (
                        <Avatar src={inv.guild.imageUrl} size={40} />
                      ) : (
                        <Avatar size={40} style={{ background: '#c0902b', fontSize: 14 }}>
                          {inv.guild.name.charAt(0)}
                        </Avatar>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Text strong>{inv.guild.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: 12 }}>Pour {inv.character.name}</Text>
                      </div>
                      <Space>
                        <Button
                          type="primary"
                          size="small"
                          icon={<CheckOutlined />}
                          onClick={() => handleAcceptInvitation(inv.token, inv.guild.name)}
                          style={{ background: '#52c41a', borderColor: '#52c41a' }}
                        >
                          Accepter
                        </Button>
                        <Button
                          size="small"
                          danger
                          icon={<CloseOutlined />}
                          onClick={() => handleDeclineInvitation(inv.token)}
                        >
                          Refuser
                        </Button>
                      </Space>
                    </div>
                  </List.Item>
                )}
              />
            </Card>
          )}

          <Card>
            <Empty
              image={<TeamOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
              description={
                <Space direction="vertical">
                  <Text>Aucun de vos personnages n'appartient à une guilde.</Text>
                  <Text type="secondary">Créez une guilde ou attendez une invitation.</Text>
                </Space>
              }
            >
              {eligibleCharacters.length > 0 ? (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateModalOpen(true)}
                  style={{ background: '#c0902b', borderColor: '#c0902b' }}
                >
                  Créer une guilde
                </Button>
              ) : (
                <Text type="secondary">Créez d'abord un personnage.</Text>
              )}
            </Empty>
          </Card>
        </Space>

        <GuildFormModal
          open={createModalOpen}
          eligibleCharacters={eligibleCharacters}
          onSubmit={handleCreateGuild}
          onCancel={() => setCreateModalOpen(false)}
        />
      </div>
    );
  }

  if (!guild) return <div style={{ padding: 24, textAlign: 'center' }}><Spin size="large" /></div>;

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2} style={{ margin: 0 }}>Guilde</Title>
          {canManage && (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setInviteModalOpen(true)}
              style={{ background: '#c0902b', borderColor: '#c0902b' }}
            >
              Inviter
            </Button>
          )}
        </div>

        <Card>
          <Space size="large">
            {guild.imageUrl ? (
              <Avatar src={guild.imageUrl} size={80} />
            ) : (
              <Avatar icon={<TeamOutlined />} size={80} style={{ background: '#c0902b' }} />
            )}
            <Space direction="vertical" size={4}>
              <Space>
                <Title level={3} style={{ margin: 0 }}>{guild.name}</Title>
                <Tag icon={<CrownOutlined />} color="gold">
                  {members.find((m) => m.characterId === guild.leaderId)?.character.name ?? 'Chef'}
                </Tag>
              </Space>
              <Text type="secondary">{members.length} membre(s)</Text>
            </Space>
          </Space>
        </Card>

        <Card
          title="Membres"
          extra={
            <Text type="secondary" style={{ fontSize: 12 }}>
              Cliquez sur un membre pour voir sa progression
            </Text>
          }
        >
          <MemberList
            members={members}
            leaderId={guild.leaderId}
            canManage={canManage}
            onRemove={handleRemoveMember}
            onMemberClick={handleMemberClick}
            progressMap={Object.fromEntries(guildProgress.map((p) => [p.characterId, p]))}
          />
        </Card>

        {/* Top quêtes bloquées */}
        {(topBlocked.length > 0 || topBlockedLoading) && (() => {
          const catSet = [...new Set(topBlocked.map((r) => r.quest?.categoryId).filter(Boolean) as number[])];
          const catFilters = catSet
            .map((id) => ({ text: catNames[id] ?? `#${id}`, value: id }))
            .sort((a, b) => a.text.localeCompare(b.text));

          const columns: ColumnsType<TopBlockedQuest> = [
            {
              title: 'Quête',
              key: 'name',
              sorter: (a, b) => (a.quest?.name.fr ?? '').localeCompare(b.quest?.name.fr ?? ''),
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
                (record.quest?.name.fr ?? '').toLowerCase().includes((value as string).toLowerCase()),
              render: (_, r) => (
                <Text>{r.quest?.name.fr ?? `Quête #${r.questId}`}</Text>
              ),
            },
            {
              title: 'Catégorie',
              key: 'category',
              sorter: (a, b) =>
                (catNames[a.quest?.categoryId ?? 0] ?? '').localeCompare(catNames[b.quest?.categoryId ?? 0] ?? ''),
              filters: catFilters,
              onFilter: (value, record) => record.quest?.categoryId === value,
              render: (_, r) => r.quest ? (
                <Text style={{ fontSize: 12 }}>{catNames[r.quest.categoryId] ?? `#${r.quest.categoryId}`}</Text>
              ) : '—',
            },
            {
              title: 'Niveau',
              key: 'level',
              width: 110,
              sorter: (a, b) => (a.quest?.levelMin || 0) - (b.quest?.levelMin || 0),
              render: (_, r) => r.quest && levelRange(r.quest.levelMin, r.quest.levelMax) ? (
                <Tag color="orange" style={{ fontSize: 11 }}>{levelRange(r.quest.levelMin, r.quest.levelMax)}</Tag>
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
                const q = record.quest;
                if (!q) return value === 'normal';
                if (value === 'dungeon') return q.isDungeonQuest;
                if (value === 'party') return q.isPartyQuest;
                if (value === 'event') return q.isEvent;
                return !q.isDungeonQuest && !q.isPartyQuest && !q.isEvent;
              },
              render: (_, r) => {
                const q = r.quest;
                if (!q) return <Tag>Normale</Tag>;
                if (q.isDungeonQuest) return <Tag color="volcano" icon={<ThunderboltOutlined />}>Donjon</Tag>;
                if (q.isPartyQuest) return <Tag color="purple">Groupe</Tag>;
                if (q.isEvent) return <Tag color="cyan">Événement</Tag>;
                return <Tag>Normale</Tag>;
              },
            },
            {
              title: 'Membres bloqués',
              key: 'members',
              width: 150,
              defaultSortOrder: 'descend',
              sorter: (a, b) => a.memberCount - b.memberCount,
              render: (_, r) => (
                <Tooltip title={r.memberNames.join(', ')}>
                  <Tag color="red">{r.memberCount} bloqué{r.memberCount > 1 ? 's' : ''}</Tag>
                </Tooltip>
              ),
            },
          ];

          return (
            <Card
              title={
                <Space>
                  <StopOutlined style={{ color: '#ff4d4f' }} />
                  <span>Top quêtes bloquées</span>
                </Space>
              }
              loading={topBlockedLoading}
            >
              <Table<TopBlockedQuest>
                dataSource={topBlocked}
                columns={columns}
                rowKey="questId"
                size="small"
                pagination={false}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune quête bloquée" /> }}
              />
            </Card>
          );
        })()}

        {/* Activité commune par catégorie */}
        {sharedActivity.length > 0 && (
          <Card
            title={
              <Space>
                <BookOutlined style={{ color: '#c0902b' }} />
                <span>Activité commune par catégorie</span>
              </Space>
            }
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              Catégories où 2 membres ou plus ont des quêtes en cours ou bloquées
            </Text>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {sharedActivity.map(({ catId, memberCount }) => (
                <div
                  key={catId}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: token.colorFillAlter,
                    borderRadius: 6,
                    border: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  <Text style={{ fontSize: 13 }}>{catNames[catId] ?? `Catégorie #${catId}`}</Text>
                  <Tag color="orange">{memberCount} membre{memberCount > 1 ? 's' : ''}</Tag>
                </div>
              ))}
            </Space>
          </Card>
        )}
      </Space>

      <InviteModal
        open={inviteModalOpen}
        onSubmit={handleInvite}
        onCancel={() => setInviteModalOpen(false)}
      />

    </div>
  );
}
