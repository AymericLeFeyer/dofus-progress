import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Layout,
  Tree,
  Card,
  Tag,
  Typography,
  Spin,
  Empty,
  Tooltip,
  Input,
  Row,
  Col,
  Button,
  Alert,
  Popconfirm,
  Pagination,
  theme,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  SearchOutlined,
  TrophyOutlined,
  StarOutlined,
  SyncOutlined,
  CheckCircleFilled,
  CheckCircleOutlined,
  CheckSquareOutlined,
} from '@ant-design/icons';
import type { AchievementCategory, Achievement } from '../types/dofusdb';
import { dofusdbService, pointsColor } from '../services/dofusdb.service';
import { useCharacterStore } from '../stores/characterStore';
import { useProgressStore } from '../stores/progressStore';

const { Content } = Layout;
const { Text, Title, Paragraph } = Typography;
const { Search } = Input;

const PAGE_SIZE = 40;

type CatWithCount = AchievementCategory & { achievementCount?: number };

function buildTree(
  categories: CatWithCount[],
  // categoryId → nbComplétés (depuis le backend, toutes catégories)
  categoryProgress: Record<number, number>,
): { nodes: DataNode[]; leafIds: Set<number> } {
  const byParent = new Map<number, CatWithCount[]>();
  categories.forEach((c) => {
    if (c.parentId !== 0) {
      const arr = byParent.get(c.parentId) ?? [];
      arr.push(c);
      byParent.set(c.parentId, arr);
    }
  });

  const leafIds = new Set<number>();

  // Calcule le total des succès et des complétés pour un nœud (récursif pour les parents)
  function totals(catId: number): { total: number; completed: number } {
    const children = byParent.get(catId);
    if (!children?.length) {
      const cat = categories.find((c) => c.id === catId);
      return { total: cat?.achievementCount ?? 0, completed: categoryProgress[catId] ?? 0 };
    }
    return children.reduce(
      (acc, child) => {
        const t = totals(child.id);
        return { total: acc.total + t.total, completed: acc.completed + t.completed };
      },
      { total: 0, completed: 0 },
    );
  }

  function pctColor(pct: number): string {
    // Rouge (0°) → vert (120°) via HSL
    const hue = Math.round(pct * 1.2);
    return `hsl(${hue}, 65%, 42%)`;
  }

  function toNode(cat: CatWithCount): DataNode {
    const children = byParent.get(cat.id);
    const { total, completed } = totals(cat.id);
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const tagColor = pctColor(pct);

    const title = (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ flex: 1 }}>{cat.name.fr}</span>
        {total > 0 && (
          <Tag
            style={{
              fontSize: 10,
              padding: '0 4px',
              margin: 0,
              backgroundColor: tagColor + '22',
              borderColor: tagColor,
              color: tagColor,
            }}
          >
            {pct}%
          </Tag>
        )}
      </span>
    );

    if (children?.length) {
      return {
        key: String(cat.id),
        title,
        children: children.sort((a, b) => a.order - b.order).map(toNode),
      };
    }
    leafIds.add(cat.id);
    return { key: String(cat.id), title, isLeaf: true };
  }

  const roots = categories.filter((c) => c.parentId === 0).sort((a, b) => a.order - b.order);
  const nodes = roots.map(toNode);
  return { nodes, leafIds };
}

export function AchievementsPage() {
  const { token } = theme.useToken();
  const { selectedCharacterId } = useCharacterStore();
  const { completedAchievementIds, achievementCategoryProgress, toggleAchievement, completeAllAchievements } =
    useProgressStore();

  const [categories, setCategories] = useState<CatWithCount[]>([]);
  const [treeNodes, setTreeNodes] = useState<DataNode[]>([]);
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null);
  const [selectedCatName, setSelectedCatName] = useState('');
  const [selectedCatTotal, setSelectedCatTotal] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingAch, setLoadingAch] = useState(false);
  const [completeAllLoading, setCompleteAllLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [isSynced, setIsSynced] = useState(true);

  useEffect(() => {
    dofusdbService
      .getAllAchievementCategories()
      .then((cats) => {
        setIsSynced(cats.length > 0);
        setCategories(cats);
        setLoadingCats(false);
      })
      .catch(() => {
        setIsSynced(false);
        setLoadingCats(false);
      });
  }, []);

  // Reconstruit l'arbre à chaque changement de complétion ou de catégories
  useEffect(() => {
    if (categories.length === 0) return;
    const { nodes } = buildTree(categories, achievementCategoryProgress);
    setTreeNodes(nodes);
  }, [categories, achievementCategoryProgress]);

  const loadAchievements = useCallback(async (catId: number) => {
    setLoadingAch(true);
    try {
      const all = await dofusdbService.getAllAchievementsForCategory(catId);
      setAchievements(all);
    } finally {
      setLoadingAch(false);
    }
  }, []);

  const onSelectCategory = (keys: React.Key[]) => {
    const id = Number(keys[0]);
    if (!id) return;
    const cat = categories.find((c) => c.id === id);
    setSelectedCatId(id);
    setSelectedCatName(cat?.name.fr ?? '');
    setSelectedCatTotal(cat?.achievementCount ?? 0);
    setPage(1);
    setAchievements([]);
    loadAchievements(id);
  };

  const handleToggle = async (achievementId: number) => {
    if (!selectedCharacterId) return;
    await toggleAchievement(selectedCharacterId, achievementId);
  };

  const handleCompleteAll = async () => {
    if (!selectedCharacterId || !selectedCatId) return;
    setCompleteAllLoading(true);
    await completeAllAchievements(selectedCharacterId, selectedCatId);
    setCompleteAllLoading(false);
  };

  const filtered = useMemo(() => {
    if (!searchValue) return achievements;
    const q = searchValue.toLowerCase();
    return achievements.filter(
      (a) => a.name.fr.toLowerCase().includes(q) || a.description?.fr?.toLowerCase().includes(q),
    );
  }, [achievements, searchValue]);

  const pagedAchievements = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [searchValue]);

  const completedInCat = achievementCategoryProgress[selectedCatId ?? 0] ?? 0;
  const catIsComplete = selectedCatTotal > 0 && completedInCat >= selectedCatTotal;

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
        {/* Left panel – category tree */}
        <div
          style={{
            width: 280,
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
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrophyOutlined style={{ color: '#c0902b' }} />
              <Text strong>Catégories</Text>
            </div>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
            {loadingCats ? (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : (
              <Tree
                treeData={treeNodes}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as string[])}
                onSelect={onSelectCategory}
                blockNode
                style={{ fontSize: 13 }}
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
            {selectedCatName ? (
              <div>
                <Title level={4} style={{ margin: 0 }}>
                  {selectedCatName}
                  {catIsComplete && (
                    <CheckCircleFilled style={{ color: '#52c41a', fontSize: 18, marginLeft: 8 }} />
                  )}
                </Title>
                <Text type="secondary">
                  {completedInCat} / {selectedCatTotal} succès complété{selectedCatTotal > 1 ? 's' : ''}
                </Text>
              </div>
            ) : (
              <Text type="secondary">Sélectionnez une catégorie</Text>
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {selectedCatId && selectedCharacterId && !catIsComplete && (
                <Popconfirm
                  title="Valider tous les succès de cette catégorie ?"
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
              {selectedCatId && (
                <Search
                  placeholder="Rechercher..."
                  allowClear
                  prefix={<SearchOutlined />}
                  style={{ width: 220 }}
                  onChange={(e) => setSearchValue(e.target.value)}
                />
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
            {!selectedCatId ? (
              <Empty
                image={<TrophyOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
                description="Choisissez une catégorie pour afficher les succès"
                style={{ marginTop: 60 }}
              />
            ) : loadingAch && achievements.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <Spin size="large" />
              </div>
            ) : filtered.length === 0 ? (
              <Empty description="Aucun succès trouvé" />
            ) : (
              <>
                {filtered.length > PAGE_SIZE && (
                  <div style={{ textAlign: 'center', padding: '0 0 12px' }}>
                    <Pagination
                      current={page}
                      pageSize={PAGE_SIZE}
                      total={filtered.length}
                      onChange={setPage}
                      showSizeChanger={false}
                      size="small"
                    />
                  </div>
                )}
                <Row gutter={[12, 12]}>
                  {pagedAchievements.map((ach) => (
                    <Col key={ach.id} xs={24} sm={12} xl={8}>
                      <AchievementCard
                        achievement={ach}
                        completed={completedAchievementIds.has(ach.id)}
                        canToggle={!!selectedCharacterId}
                        onToggle={() => handleToggle(ach.id)}
                      />
                    </Col>
                  ))}
                </Row>
                {filtered.length > PAGE_SIZE && (
                  <div style={{ textAlign: 'center', padding: '12px 0' }}>
                    <Pagination
                      current={page}
                      pageSize={PAGE_SIZE}
                      total={filtered.length}
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
      </Layout>
    </Layout>
  );
}

function AchievementCard({
  achievement: ach,
  completed,
  canToggle,
  onToggle,
}: {
  achievement: Achievement;
  completed: boolean;
  canToggle: boolean;
  onToggle: () => void;
}) {
  const { token } = theme.useToken();
  return (
    <Card
      size="small"
      style={{
        height: '100%',
        background: completed ? token.colorSuccessBg : token.colorBgContainer,
        borderColor: completed ? token.colorSuccessBorder : undefined,
        opacity: completed ? 0.85 : 1,
        transition: 'all 0.2s',
      }}
      bodyStyle={{ padding: '10px 12px' }}
    >
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, position: 'relative' }}>
          {ach.img ? (
            <img
              src={ach.img}
              alt={ach.name.fr}
              width={48}
              height={48}
              style={{
                borderRadius: 6,
                objectFit: 'contain',
                background: '#f5f5f5',
                filter: completed ? 'grayscale(30%)' : undefined,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                background: '#f0f0f0',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <StarOutlined style={{ color: '#aaa' }} />
            </div>
          )}
          {completed && (
            <CheckCircleFilled
              style={{
                position: 'absolute',
                bottom: -4,
                right: -4,
                color: '#52c41a',
                background: '#fff',
                borderRadius: '50%',
                fontSize: 16,
              }}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
            <Text
              strong
              style={{
                fontSize: 13,
                lineHeight: '18px',
                textDecoration: completed ? 'line-through' : undefined,
                color: completed ? '#52c41a' : undefined,
              }}
            >
              {ach.name.fr}
            </Text>
            <Tooltip title={`${ach.points} point${ach.points > 1 ? 's' : ''}`}>
              <Tag color={pointsColor(ach.points)} style={{ marginLeft: 4, flexShrink: 0, cursor: 'default' }}>
                {ach.points} pt{ach.points > 1 ? 's' : ''}
              </Tag>
            </Tooltip>
          </div>
          {ach.description?.fr && (
            <Paragraph
              type="secondary"
              style={{ margin: '2px 0 0', fontSize: 12, lineHeight: '16px' }}
              ellipsis={{ rows: 2, tooltip: ach.description.fr }}
            >
              {ach.description.fr}
            </Paragraph>
          )}
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {ach.level > 0 ? <Tag style={{ fontSize: 11 }}>Niv. {ach.level}</Tag> : <span />}
            <Tooltip title={canToggle ? undefined : 'Sélectionne un personnage'}>
              <Button
                size="small"
                type={completed ? 'default' : 'primary'}
                icon={completed ? <CheckCircleOutlined /> : undefined}
                disabled={!canToggle}
                onClick={onToggle}
                style={
                  completed
                    ? { fontSize: 11, background: '#f6ffed', borderColor: '#52c41a', color: '#52c41a' }
                    : { fontSize: 11, background: '#c0902b', borderColor: '#c0902b' }
                }
              >
                {completed ? 'Complété' : 'Valider'}
              </Button>
            </Tooltip>
          </div>
        </div>
      </div>
    </Card>
  );
}
