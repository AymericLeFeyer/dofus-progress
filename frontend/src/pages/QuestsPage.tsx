import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Layout,
  List,
  Tag,
  Typography,
  Spin,
  Empty,
  Drawer,
  Space,
  Divider,
  Input,
  Tooltip,
  Steps,
  Skeleton,
  Alert,
  Button,
  Popconfirm,
  Select,
  Switch,
  Pagination,
  theme,
} from 'antd';
import {
  BookOutlined,
  SearchOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  ReloadOutlined,
  RightOutlined,
  SyncOutlined,
  CheckCircleFilled,
  CheckSquareOutlined,
  CheckOutlined,
  EyeInvisibleOutlined,
} from '@ant-design/icons';
import type { QuestCategory, Quest, QuestStep } from '../types/dofusdb';
import { dofusdbService, levelRange } from '../services/dofusdb.service';
import type { QuestStatus } from '../services/progress.service';
import { useCharacterStore } from '../stores/characterStore';
import { useProgressStore } from '../stores/progressStore';

const { Content } = Layout;
const { Text, Title, Paragraph } = Typography;
const { Search } = Input;

const PAGE_SIZE = 50;

const STATUS_CONFIG: Record<QuestStatus, { label: string; color: string }> = {
  todo:      { label: 'À faire',  color: '#8c8c8c' },
  started:   { label: 'En cours', color: '#1677ff' },
  completed: { label: 'Terminé',  color: '#52c41a' },
  blocked:   { label: 'Bloqué',   color: '#ff4d4f' },
};

function getQuestStatus(
  questId: number,
  completedQuestIds: Set<number>,
  startedQuestIds: Set<number>,
  blockedQuestIds: Set<number>,
): QuestStatus {
  if (completedQuestIds.has(questId)) return 'completed';
  if (startedQuestIds.has(questId)) return 'started';
  if (blockedQuestIds.has(questId)) return 'blocked';
  return 'todo';
}

export function QuestsPage() {
  const { token } = theme.useToken();
  const { selectedCharacterId } = useCharacterStore();
  const {
    completedQuestIds,
    startedQuestIds,
    blockedQuestIds,
    completedQuestCategoryProgress,
    startedQuestCategoryProgress,
    blockedQuestCategoryProgress,
    questCategoryProgress,
    setQuestStatus,
    completeAllQuests,
  } = useProgressStore();

  const [categories, setCategories] = useState<(QuestCategory & { questCount?: number })[]>([]);
  const [selectedCat, setSelectedCat] = useState<(QuestCategory & { questCount?: number }) | null>(null);
  const [isSynced, setIsSynced] = useState(true);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingQuests, setLoadingQuests] = useState(false);
  const [completeAllLoading, setCompleteAllLoading] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [questSearch, setQuestSearch] = useState('');
  const [hideCompleted, setHideCompleted] = useState(false);
  const [page, setPage] = useState(1);

  // Drawer
  const [drawerQuest, setDrawerQuest] = useState<Quest | null>(null);
  const [steps, setSteps] = useState<QuestStep[]>([]);
  const [loadingSteps, setLoadingSteps] = useState(false);

  useEffect(() => {
    dofusdbService
      .getAllQuestCategories()
      .then((cats) => {
        setIsSynced(cats.length > 0);
        setCategories(cats.sort((a, b) => a.name.fr.localeCompare(b.name.fr)));
        setLoadingCats(false);
      })
      .catch(() => {
        setIsSynced(false);
        setLoadingCats(false);
      });
  }, []);

  const selectCategory = useCallback(async (cat: QuestCategory & { questCount?: number }) => {
    setSelectedCat(cat);
    setQuestSearch('');
    setPage(1);
    setQuests([]);
    setLoadingQuests(true);
    try {
      const all = await dofusdbService.getAllQuestsForCategory(cat.id);
      setQuests(all);
    } finally {
      setLoadingQuests(false);
    }
  }, []);

  const openQuestDetail = async (quest: Quest) => {
    setDrawerQuest(quest);
    setSteps([]);
    if (quest.stepIds.length > 0) {
      setLoadingSteps(true);
      const s = await dofusdbService.getQuestSteps(quest.stepIds);
      setSteps(s);
      setLoadingSteps(false);
    }
  };

  const handleSetStatus = async (questId: number, status: QuestStatus) => {
    if (!selectedCharacterId) return;
    await setQuestStatus(selectedCharacterId, questId, status);
  };

  const handleCompleteAll = async () => {
    if (!selectedCharacterId || !selectedCat) return;
    setCompleteAllLoading(true);
    await completeAllQuests(selectedCharacterId, selectedCat.id);
    setCompleteAllLoading(false);
  };

  const filteredCats = useMemo(() => {
    if (!catSearch) return categories;
    const q = catSearch.toLowerCase();
    return categories.filter((c) => c.name.fr.toLowerCase().includes(q));
  }, [categories, catSearch]);

  const filteredQuests = useMemo(() => {
    let result = quests;
    if (hideCompleted) result = result.filter((q) => !completedQuestIds.has(q.id));
    if (questSearch) {
      const q = questSearch.toLowerCase();
      result = result.filter((quest) => quest.name.fr.toLowerCase().includes(q));
    }
    return result;
  }, [quests, questSearch, hideCompleted, completedQuestIds]);

  const pagedQuests = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredQuests.slice(start, start + PAGE_SIZE);
  }, [filteredQuests, page]);

  // Revenir à la page 1 quand les filtres changent
  useEffect(() => { setPage(1); }, [questSearch, hideCompleted]);

  const catIsComplete = (cat: QuestCategory & { questCount?: number }) => {
    const catTotal = cat.questCount ?? cat.questIds?.length ?? 0;
    const completed = questCategoryProgress[cat.id] ?? 0;
    return catTotal > 0 && completed >= catTotal;
  };

  const selectedCatTotal = selectedCat?.questCount ?? selectedCat?.questIds?.length ?? 0;
  const selectedCatCompleted = completedQuestCategoryProgress[selectedCat?.id ?? 0] ?? 0;
  const selectedCatStarted = startedQuestCategoryProgress[selectedCat?.id ?? 0] ?? 0;
  const selectedCatBlocked = blockedQuestCategoryProgress[selectedCat?.id ?? 0] ?? 0;
  const selectedCatIsComplete = selectedCatTotal > 0 && selectedCatCompleted >= selectedCatTotal;

  return (
    <Layout style={{ height: 'calc(100vh - 112px)', background: 'transparent', flexDirection: 'column' }}>
      {!isSynced && !loadingCats && (
        <Alert
          type="warning"
          showIcon
          icon={<SyncOutlined />}
          message="Données non synchronisées"
          description={
            <span>
              Lance : <code>docker-compose exec backend npm run sync:dofusdb</code>
            </span>
          }
          style={{ marginBottom: 12 }}
        />
      )}
      {!selectedCharacterId && (
        <Alert
          type="info"
          showIcon
          message="Aucun personnage sélectionné"
          description="Sélectionne un personnage dans la barre du haut pour suivre ta progression."
          style={{ marginBottom: 12 }}
        />
      )}
      <Layout style={{ flex: 1, background: 'transparent', overflow: 'hidden', flexDirection: 'row' }}>
        {/* Left panel – categories */}
        <div
          style={{
            width: 260,
            flexShrink: 0,
            background: token.colorBgContainer,
            borderRadius: 8,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginRight: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ padding: '12px 12px 8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BookOutlined style={{ color: '#c0902b' }} />
              <Text strong>Catégories</Text>
            </div>
            <Search
              placeholder="Filtrer..."
              allowClear
              size="small"
              onChange={(e) => setCatSearch(e.target.value)}
            />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingCats ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : (
              <List
                size="small"
                dataSource={filteredCats}
                renderItem={(cat) => {
                  const complete = catIsComplete(cat);
                  const catTotal = cat.questCount ?? cat.questIds?.length ?? 0;
                  const completed = completedQuestCategoryProgress[cat.id] ?? 0;
                  const started = startedQuestCategoryProgress[cat.id] ?? 0;
                  const blocked = blockedQuestCategoryProgress[cat.id] ?? 0;
                  return (
                    <List.Item
                      style={{
                        padding: '6px 12px',
                        cursor: 'pointer',
                        background:
                          selectedCat?.id === cat.id ? '#fff7e6' : complete ? '#f6ffed' : 'transparent',
                        borderLeft:
                          selectedCat?.id === cat.id
                            ? '3px solid #c0902b'
                            : complete
                              ? '3px solid #52c41a'
                              : '3px solid transparent',
                        transition: 'all 0.15s',
                      }}
                      onClick={() => selectCategory(cat)}
                    >
                      <div style={{ width: '100%' }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {complete && (
                            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 12, flexShrink: 0 }} />
                          )}
                          <Text
                            style={{
                              fontSize: 13,
                              lineHeight: '18px',
                              flex: 1,
                              color: complete ? '#52c41a' : undefined,
                            }}
                            ellipsis
                          >
                            {cat.name.fr}
                          </Text>
                          {complete ? (
                            <Tag
                              style={{
                                fontSize: 10,
                                padding: '0 4px',
                                margin: 0,
                                backgroundColor: '#f6ffed',
                                borderColor: '#52c41a',
                                color: '#52c41a',
                              }}
                            >
                              100%
                            </Tag>
                          ) : completed > 0 ? (
                            <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                              {Math.round((completed / catTotal) * 100)}%
                            </Tag>
                          ) : (
                            <Tag style={{ fontSize: 10, padding: '0 4px', margin: 0, color: '#8c8c8c', borderColor: '#d9d9d9' }}>
                              0%
                            </Tag>
                          )}
                        </div>
                        {(started > 0 || blocked > 0) && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            {started > 0 && (
                              <Tag color="blue" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                {started} en cours
                              </Tag>
                            )}
                            {blocked > 0 && (
                              <Tag color="red" style={{ fontSize: 10, padding: '0 4px', margin: 0 }}>
                                {blocked} bloqué{blocked > 1 ? 's' : ''}
                              </Tag>
                            )}
                          </div>
                        )}
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        </div>

        {/* Main content */}
        <Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div
            style={{
              background: token.colorBgContainer,
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 12,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            {selectedCat ? (
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {selectedCat.name.fr}
                  {selectedCatIsComplete && (
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18, marginLeft: 8 }} />
                  )}
                </Title>
                <Space size={8}>
                  <Text type="secondary">
                    {selectedCatCompleted}/{quests.length} terminée{quests.length > 1 ? 's' : ''}
                  </Text>
                  {selectedCatStarted > 0 && (
                    <Tag color="blue" style={{ margin: 0 }}>{selectedCatStarted} en cours</Tag>
                  )}
                  {selectedCatBlocked > 0 && (
                    <Tag color="red" style={{ margin: 0 }}>{selectedCatBlocked} bloquée{selectedCatBlocked > 1 ? 's' : ''}</Tag>
                  )}
                </Space>
              </div>
            ) : (
              <Text type="secondary">Sélectionnez une catégorie</Text>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedCat && selectedCharacterId && !selectedCatIsComplete && (
                <Popconfirm
                  title="Valider toutes les quêtes de cette catégorie ?"
                  onConfirm={handleCompleteAll}
                  okText="Valider tout"
                  cancelText="Annuler"
                >
                  <Button
                    icon={<CheckSquareOutlined />}
                    loading={completeAllLoading}
                    style={{ borderColor: '#c0902b', color: '#c0902b' }}
                  >
                    Valider tout
                  </Button>
                </Popconfirm>
              )}
              {selectedCat && selectedCharacterId && (
                <Tooltip title="Masquer les quêtes terminées">
                  <Switch
                    size="small"
                    checked={hideCompleted}
                    onChange={setHideCompleted}
                    checkedChildren={<EyeInvisibleOutlined />}
                    unCheckedChildren={<EyeInvisibleOutlined />}
                  />
                </Tooltip>
              )}
              {selectedCat && (
                <Search
                  placeholder="Rechercher une quête..."
                  allowClear
                  prefix={<SearchOutlined />}
                  style={{ width: 240 }}
                  onChange={(e) => setQuestSearch(e.target.value)}
                />
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto' }}>
            {!selectedCat ? (
              <Empty
                image={<BookOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
                description="Choisissez une catégorie"
                style={{ marginTop: 60 }}
              />
            ) : loadingQuests && quests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin size="large" />
              </div>
            ) : filteredQuests.length === 0 ? (
              <Empty description="Aucune quête trouvée" />
            ) : (
              <>
                {filteredQuests.length > PAGE_SIZE && (
                  <div style={{ textAlign: 'center', padding: '0 0 12px' }}>
                    <Pagination
                      current={page}
                      pageSize={PAGE_SIZE}
                      total={filteredQuests.length}
                      onChange={setPage}
                      showSizeChanger={false}
                      size="small"
                    />
                  </div>
                )}
                <List
                  dataSource={pagedQuests}
                  style={{ background: token.colorBgContainer, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                  renderItem={(quest) => {
                    const status = getQuestStatus(quest.id, completedQuestIds, startedQuestIds, blockedQuestIds);
                    return (
                      <QuestListItem
                        quest={quest}
                        status={status}
                        canToggle={!!selectedCharacterId}
                        onClick={() => openQuestDetail(quest)}
                        onSetStatus={(s) => handleSetStatus(quest.id, s)}
                      />
                    );
                  }}
                />
                {filteredQuests.length > PAGE_SIZE && (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <Pagination
                      current={page}
                      pageSize={PAGE_SIZE}
                      total={filteredQuests.length}
                      onChange={setPage}
                      showSizeChanger={false}
                      size="small"
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </Content>

        {/* Quest detail drawer */}
        <Drawer
          title={drawerQuest?.name.fr ?? 'Détail quête'}
          open={!!drawerQuest}
          onClose={() => setDrawerQuest(null)}
          width={480}
          extra={
            <Space>
              {drawerQuest && selectedCharacterId && (() => {
                const status = getQuestStatus(drawerQuest.id, completedQuestIds, startedQuestIds, blockedQuestIds);
                return (
                  <Select
                    value={status}
                    onChange={(s) => handleSetStatus(drawerQuest.id, s)}
                    size="small"
                    style={{ width: 120 }}
                    options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({
                      value: k,
                      label: <span style={{ color: v.color }}>{v.label}</span>,
                    }))}
                  />
                );
              })()}
              {drawerQuest?.isDungeonQuest && (
                <Tag color="volcano" icon={<ThunderboltOutlined />}>
                  Donjon
                </Tag>
              )}
              {drawerQuest?.isPartyQuest && (
                <Tag color="blue" icon={<TeamOutlined />}>
                  Groupe
                </Tag>
              )}
              {drawerQuest?.repeatType !== 0 && (
                <Tag color="green" icon={<ReloadOutlined />}>
                  Répétable
                </Tag>
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
                <Tag>
                  {drawerQuest.stepIds.length} étape{drawerQuest.stepIds.length > 1 ? 's' : ''}
                </Tag>
                {drawerQuest.followable && <Tag color="cyan">Suivable</Tag>}
              </div>
              <Divider style={{ margin: '4px 0' }} />
              <div>
                <Text strong>Étapes</Text>
                {loadingSteps ? (
                  <Skeleton active paragraph={{ rows: 4 }} style={{ marginTop: 12 }} />
                ) : steps.length > 0 ? (
                  <Steps
                    direction="vertical"
                    size="small"
                    style={{ marginTop: 12 }}
                    items={steps.map((step) => ({
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
                            {step.objectiveIds.length} objectif
                            {step.objectiveIds.length > 1 ? 's' : ''}
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
      </Layout>
    </Layout>
  );
}

function QuestListItem({
  quest,
  status,
  canToggle,
  onClick,
  onSetStatus,
}: {
  quest: Quest;
  status: QuestStatus;
  canToggle: boolean;
  onClick: () => void;
  onSetStatus: (status: QuestStatus) => void;
}) {
  const { token } = theme.useToken();
  const cfg = STATUS_CONFIG[status];
  const bgColor =
    status === 'completed' ? token.colorSuccessBg :
    status === 'started'   ? token.colorInfoBg :
    status === 'blocked'   ? token.colorErrorBg :
    'transparent';

  return (
    <List.Item
      style={{
        padding: '8px 16px',
        cursor: 'pointer',
        transition: 'background 0.15s',
        background: bgColor,
      }}
      onMouseEnter={(e) =>
        status === 'todo' && ((e.currentTarget as HTMLElement).style.background = '#fafafa')
      }
      onMouseLeave={(e) =>
        ((e.currentTarget as HTMLElement).style.background = bgColor)
      }
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 10 }}>
        <Tooltip title={canToggle ? 'Changer le statut' : 'Sélectionne un personnage'}>
          <Select
            value={status}
            disabled={!canToggle}
            size="small"
            style={{ width: 110, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
            onChange={(s) => onSetStatus(s)}
            options={Object.entries(STATUS_CONFIG).map(([k, v]) => ({
              value: k,
              label: <span style={{ color: v.color, fontSize: 12 }}>{v.label}</span>,
            }))}
          />
        </Tooltip>
        {canToggle && (
          <Tooltip title={status === 'completed' ? 'Marquer à faire' : 'Marquer terminée'}>
            <Button
              size="small"
              type="text"
              icon={<CheckOutlined />}
              style={{ color: status === 'completed' ? '#52c41a' : '#d9d9d9', flexShrink: 0 }}
              onClick={(e) => { e.stopPropagation(); onSetStatus(status === 'completed' ? 'todo' : 'completed'); }}
            />
          </Tooltip>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: 500,
              textDecoration: status === 'completed' ? 'line-through' : undefined,
              color: cfg.color !== '#8c8c8c' ? cfg.color : undefined,
            }}
            ellipsis={{ tooltip: quest.name.fr }}
          >
            {quest.name.fr}
          </Text>
          <div style={{ marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(quest.levelMin > 0 || quest.levelMax > 0) && (
              <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>
                {levelRange(quest.levelMin, quest.levelMax)}
              </Tag>
            )}
            {quest.isDungeonQuest && (
              <Tag color="volcano" icon={<ThunderboltOutlined />} style={{ fontSize: 11, margin: 0 }}>
                Donjon
              </Tag>
            )}
            {quest.isPartyQuest && (
              <Tag color="blue" icon={<TeamOutlined />} style={{ fontSize: 11, margin: 0 }}>
                Groupe
              </Tag>
            )}
            {quest.repeatType !== 0 && (
              <Tag color="green" icon={<ReloadOutlined />} style={{ fontSize: 11, margin: 0 }}>
                Répétable
              </Tag>
            )}
          </div>
        </div>
        <RightOutlined style={{ color: '#aaa', flexShrink: 0 }} />
      </div>
    </List.Item>
  );
}
