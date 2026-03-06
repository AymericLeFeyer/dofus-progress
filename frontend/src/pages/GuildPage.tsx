import { useCallback, useEffect, useState } from 'react';
import { Card, Button, Typography, Space, Avatar, Tag, Empty, Spin, message, Tooltip, Table, Input, List, Tabs, Drawer, Divider, Skeleton, Steps } from 'antd';
import type { ColumnsType, FilterDropdownProps } from 'antd/es/table/interface';
import {
  TeamOutlined, PlusOutlined, UserAddOutlined, CrownOutlined,
  StopOutlined, ThunderboltOutlined, MailOutlined, CheckOutlined, CloseOutlined, SearchOutlined,
  CompassOutlined, TrophyOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useCharacterStore } from '../stores/characterStore';
import { useGuildStore } from '../stores/guildStore';
import { GuildFormModal } from '../components/guild/GuildFormModal';
import { MemberList } from '../components/guild/MemberList';
import { ClassAvatar } from '../components/character/ClassAvatar';
import { InviteModal } from '../components/guild/InviteModal';
import { CreateGuildData } from '../types';
import { AxiosError } from 'axios';
import { progressService, GuildMemberProgress } from '../services/progress.service';
import { dofusdbService, levelRange } from '../services/dofusdb.service';
import type { Dungeon, Quest, QuestStep } from '../types/dofusdb';
import { ActivityTab } from '../components/guild/ActivityTab';

const { Title, Text, Paragraph } = Typography;

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

type MemberStub = { characterId: string; name: string; class: string };

type TopBlockedQuest = {
  questId: number;
  memberCount: number;
  memberCharacters: MemberStub[];
  quest: QuestStub | null;
};

export function GuildPage() {
  const navigate = useNavigate();
  const { characters, fetchCharacters } = useCharacterStore();
  const { guild, members, fetchGuild, createGuild, inviteCharacter, removeMember, invitations, fetchInvitations, acceptInvitation, declineInvitation } = useGuildStore();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  // Guild progress
  const [guildProgress, setGuildProgress] = useState<GuildMemberProgress[]>([]);

  // Quest detail drawer
  const [drawerQuest, setDrawerQuest] = useState<Quest | null>(null);
  const [drawerSteps, setDrawerSteps] = useState<QuestStep[]>([]);
  const [drawerStepsLoading, setDrawerStepsLoading] = useState(false);

  // Top blocked quests (fetched)
  const [topBlocked, setTopBlocked] = useState<TopBlockedQuest[]>([]);
  const [topBlockedLoading, setTopBlockedLoading] = useState(false);

  // Category names map
  const [catNames, setCatNames] = useState<Record<number, string>>({});

  // Dungeons
  const [dungeonMap, setDungeonMap] = useState<Map<number, Dungeon>>(new Map());

  useEffect(() => {
    fetchCharacters();
    fetchInvitations();
    dofusdbService.getAllQuestCategories().then((cats) => {
      const m: Record<number, string> = {};
      cats.forEach((c) => { m[c.id] = c.name.fr; });
      setCatNames(m);
    }).catch(() => {});
    dofusdbService.getAllDungeons().then((dungeons) => {
      setDungeonMap(new Map(dungeons.map((d) => [d.id, d])));
    }).catch(() => {});
  }, [fetchCharacters, fetchInvitations]);

  // Find the first character in a guild
  const characterInGuild = characters.find((c) => c.guildMember);
  const guildId = characterInGuild?.guildMember?.guildId;

  useEffect(() => {
    if (guildId) fetchGuild(guildId);
  }, [guildId, fetchGuild]);

  const refreshMemberProgress = useCallback(async (): Promise<GuildMemberProgress[]> => {
    if (!guildId) return [];
    const { members: progressMembers } = await progressService.getGuildProgress(guildId);
    setGuildProgress(progressMembers);
    return progressMembers;
  }, [guildId]);

  useEffect(() => {
    if (!guildId) return;
    progressService.getGuildProgress(guildId).then(async ({ members: progressMembers }) => {
      setGuildProgress(progressMembers);

      // Compute top blocked quests (only on initial load)
      const questCount: Record<number, { count: number; members: MemberStub[] }> = {};
      progressMembers.forEach((mp) => {
        (mp.blockedQuestIds ?? []).forEach((qid) => {
          if (!questCount[qid]) questCount[qid] = { count: 0, members: [] };
          questCount[qid].count++;
          questCount[qid].members.push({ characterId: mp.characterId, name: mp.name, class: mp.class });
        });
      });

      const sorted = Object.entries(questCount)
        .map(([qid, { count, members }]) => ({ questId: Number(qid), memberCount: count, memberCharacters: members }))
        .sort((a, b) => b.memberCount - a.memberCount);

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

  // Donjons en commun : donjons "à faire" par 1+ membres
  type SharedDungeon = { dungeonId: number; memberCount: number; memberCharacters: MemberStub[]; dungeon: Dungeon | null };
  const sharedDungeons: SharedDungeon[] = (() => {
    const counts: Record<number, { count: number; members: MemberStub[] }> = {};
    guildProgress.forEach((mp) => {
      (mp.todoDungeonIds ?? []).forEach((did) => {
        if (!counts[did]) counts[did] = { count: 0, members: [] };
        counts[did].count++;
        counts[did].members.push({ characterId: mp.characterId, name: mp.name, class: mp.class });
      });
    });
    return Object.entries(counts)
      .filter(([, v]) => v.count >= 1)
      .map(([did, { count, members }]) => ({
        dungeonId: Number(did),
        memberCount: count,
        memberCharacters: members,
        dungeon: dungeonMap.get(Number(did)) ?? null,
      }))
      .sort((a, b) => b.memberCount - a.memberCount);
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

  const openQuestDetail = async (questId: number) => {
    const quest = await dofusdbService.getQuestById(questId);
    if (!quest) return;
    setDrawerQuest(quest);
    setDrawerSteps([]);
    if (quest.stepIds.length > 0) {
      setDrawerStepsLoading(true);
      const steps = await dofusdbService.getQuestSteps(quest.stepIds);
      setDrawerSteps(steps);
      setDrawerStepsLoading(false);
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
    <div style={{ padding: 24, paddingBottom: 80 }}>
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

        {/* Tabs : quêtes bloquées + donjons à faire + nouvelle activité */}
        {(() => {
          const allMembersSet = new Map<string, MemberStub>();
          topBlocked.forEach((r) => r.memberCharacters.forEach((m) => {
            if (!allMembersSet.has(m.characterId)) allMembersSet.set(m.characterId, m);
          }));
          const allMembersInBlocked = [...allMembersSet.values()].sort((a, b) => a.name.localeCompare(b.name));

          const catSet = [...new Set(topBlocked.map((r) => r.quest?.categoryId).filter(Boolean) as number[])];
          const catFilters = catSet
            .map((id) => ({ text: catNames[id] ?? `#${id}`, value: id }))
            .sort((a, b) => a.text.localeCompare(b.text));

          const questColumns: ColumnsType<TopBlockedQuest> = [
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
                <Text
                  style={{ cursor: 'pointer', color: '#1677ff' }}
                  onClick={() => openQuestDetail(r.questId)}
                >
                  {r.quest?.name.fr ?? `Quête #${r.questId}`}
                </Text>
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
              title: 'Membres',
              key: 'members',
              width: 160,
              defaultSortOrder: 'descend',
              sorter: (a, b) => a.memberCount - b.memberCount,
              filters: allMembersInBlocked.map((m) => ({
                text: (
                  <Space size={6}>
                    <ClassAvatar className={m.class} size={18} />
                    <span>{m.name}</span>
                  </Space>
                ),
                value: m.characterId,
              })),
              onFilter: (value, record) =>
                record.memberCharacters.some((m) => m.characterId === value),
              render: (_, r) => (
                <Space size={4}>
                  {r.memberCharacters.map((m) => (
                    <Tooltip key={m.characterId} title={m.name}>
                      <span><ClassAvatar className={m.class} size={22} /></span>
                    </Tooltip>
                  ))}
                </Space>
              ),
            },
          ];

          const allDungeonMembersSet = new Map<string, MemberStub>();
          sharedDungeons.forEach((r) => r.memberCharacters.forEach((m) => {
            if (!allDungeonMembersSet.has(m.characterId)) allDungeonMembersSet.set(m.characterId, m);
          }));
          const allDungeonMembers = [...allDungeonMembersSet.values()].sort((a, b) => a.name.localeCompare(b.name));

          const dungeonColumns: ColumnsType<typeof sharedDungeons[0]> = [
            {
              title: 'Donjon',
              key: 'name',
              sorter: (a, b) => (a.dungeon?.name.fr ?? '').localeCompare(b.dungeon?.name.fr ?? ''),
              render: (_, r) => <Text>{r.dungeon?.name.fr ?? `Donjon #${r.dungeonId}`}</Text>,
            },
            {
              title: 'Membres',
              key: 'members',
              width: 160,
              defaultSortOrder: 'descend',
              sorter: (a, b) => a.memberCount - b.memberCount,
              filters: allDungeonMembers.map((m) => ({
                text: (
                  <Space size={6}>
                    <ClassAvatar className={m.class} size={18} />
                    <span>{m.name}</span>
                  </Space>
                ),
                value: m.characterId,
              })),
              onFilter: (value, record) =>
                record.memberCharacters.some((m) => m.characterId === value),
              render: (_, r) => (
                <Space size={4}>
                  {r.memberCharacters.map((m) => (
                    <Tooltip key={m.characterId} title={m.name}>
                      <span><ClassAvatar className={m.class} size={22} /></span>
                    </Tooltip>
                  ))}
                </Space>
              ),
            },
          ];

          return (
            <Card bodyStyle={{ padding: 0 }} loading={topBlockedLoading}>
              <Tabs
                style={{ padding: '0 16px' }}
                items={[
                  {
                    key: 'blocked',
                    label: (
                      <Space size={6}>
                        <StopOutlined style={{ color: '#ff4d4f' }} />
                        <span>Quêtes bloquées</span>
                        <Tag color="red" style={{ marginLeft: 0 }}>{topBlocked.length}</Tag>
                      </Space>
                    ),
                    children: (
                      <Table<TopBlockedQuest>
                        dataSource={topBlocked}
                        columns={questColumns}
                        rowKey="questId"
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} quêtes` }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune quête bloquée" /> }}
                        style={{ marginTop: 4 }}
                      />
                    ),
                  },
                  {
                    key: 'dungeons',
                    label: (
                      <Space size={6}>
                        <CompassOutlined style={{ color: '#c0902b' }} />
                        <span>Donjons à faire</span>
                        <Tag color="gold" style={{ marginLeft: 0 }}>{sharedDungeons.length}</Tag>
                      </Space>
                    ),
                    children: (
                      <Table<typeof sharedDungeons[0]>
                        dataSource={sharedDungeons}
                        columns={dungeonColumns}
                        rowKey="dungeonId"
                        size="small"
                        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} donjons` }}
                        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun donjon à faire dans la guilde" /> }}
                        style={{ marginTop: 4 }}
                      />
                    ),
                  },
                  {
                    key: 'activity',
                    label: (
                      <Space size={6}>
                        <TrophyOutlined style={{ color: '#c0902b' }} />
                        <span>Nouvelle activité</span>
                      </Space>
                    ),
                    children: (
                      <ActivityTab
                        guildProgress={guildProgress}
                        dungeonMap={dungeonMap}
                        catNames={catNames}
                        onRefreshProgress={refreshMemberProgress}
                      />
                    ),
                  },
                ]}
              />
            </Card>
          );
        })()}
      </Space>

      <InviteModal
        open={inviteModalOpen}
        onSubmit={handleInvite}
        onCancel={() => setInviteModalOpen(false)}
      />

      <Drawer
        title={drawerQuest?.name.fr ?? 'Détail quête'}
        open={!!drawerQuest}
        onClose={() => { setDrawerQuest(null); setDrawerSteps([]); }}
        width={480}
        extra={
          <Space>
            {drawerQuest?.isDungeonQuest && (
              <Tag color="volcano" icon={<ThunderboltOutlined />}>Donjon</Tag>
            )}
            {drawerQuest?.isPartyQuest && (
              <Tag color="blue" icon={<TeamOutlined />}>Groupe</Tag>
            )}
            {drawerQuest?.repeatType !== undefined && drawerQuest.repeatType !== 0 && (
              <Tag color="green" icon={<ReloadOutlined />}>Répétable</Tag>
            )}
          </Space>
        }
      >
        {drawerQuest && (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(drawerQuest.levelMin > 0 || drawerQuest.levelMax > 0) && (
                <Tag color="orange" style={{ fontSize: 14, padding: '2px 10px' }}>
                  {levelRange(drawerQuest.levelMin, drawerQuest.levelMax)}
                </Tag>
              )}
              <Tag>{drawerQuest.stepIds.length} étape{drawerQuest.stepIds.length > 1 ? 's' : ''}</Tag>
              {drawerQuest.followable && <Tag color="cyan">Suivable</Tag>}
            </div>
            <Divider style={{ margin: '4px 0' }} />
            <div>
              <Text strong>Étapes</Text>
              {drawerStepsLoading ? (
                <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 12 }} />
              ) : drawerSteps.length > 0 ? (
                <Steps
                  direction="vertical"
                  size="small"
                  style={{ marginTop: 12 }}
                  items={drawerSteps.map((step) => ({
                    title: <Text strong>{step.name.fr}</Text>,
                    description: (
                      <Space direction="vertical" size={2} style={{ paddingBottom: 8 }}>
                        {step.description?.fr && (
                          <Paragraph type="secondary" style={{ margin: 0, fontSize: 12 }}>
                            {step.description.fr}
                          </Paragraph>
                        )}
                        {step.optimalLevel > 0 && (
                          <Tag style={{ fontSize: 11 }}>Niv. optimal : {step.optimalLevel}</Tag>
                        )}
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          {step.objectiveIds.length} objectif{step.objectiveIds.length > 1 ? 's' : ''}
                        </Text>
                      </Space>
                    ),
                    status: 'wait' as const,
                  }))}
                />
              ) : (
                <Paragraph type="secondary" style={{ marginTop: 8 }}>
                  Aucune information sur les étapes disponible.
                </Paragraph>
              )}
            </div>
          </Space>
        )}
      </Drawer>

    </div>
  );
}
