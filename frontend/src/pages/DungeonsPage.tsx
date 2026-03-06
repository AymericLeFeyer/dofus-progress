import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Input,
  Tag,
  Typography,
  Spin,
  Empty,
  Space,
  Tooltip,
  Divider,
  Radio,
  Button,
  Switch,
} from 'antd';
import {
  SearchOutlined,
  BugOutlined,
  BookOutlined,
  CheckCircleOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { Dungeon } from '../types/dofusdb';
import { dofusdbService } from '../services/dofusdb.service';
import { useCharacterStore } from '../stores/characterStore';
import { useProgressStore } from '../stores/progressStore';

const { Text } = Typography;
const { Search } = Input;

type StatusFilter = 'all' | 'todo' | 'done';

function levelTagColor(level: number): string {
  if (level >= 190) return '#722ed1';
  if (level >= 150) return '#f5222d';
  if (level >= 100) return '#fa8c16';
  if (level >= 50) return '#1677ff';
  return '#52c41a';
}

function statusBorderColor(characterId: string | null, isTodo: boolean, isDone: boolean): string {
  if (!characterId) return '#d9d9d9';
  if (isTodo) return '#ff4d4f'; // rouge prioritaire
  if (isDone) return '#52c41a';
  return '#d9d9d9';
}

export function DungeonsPage() {
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [hideDone, setHideDone] = useState(false);

  const { selectedCharacterId } = useCharacterStore();
  const { todoDungeonIds, doneDungeonIds, setDungeonStatus } = useProgressStore();

  useEffect(() => {
    dofusdbService.getAllDungeons().then((data) => {
      const sorted = [...data].sort((a, b) => a.name.fr.localeCompare(b.name.fr));
      setDungeons(sorted);
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dungeons.filter((d) => {
      const nameMatch = !q || d.name.fr.toLowerCase().includes(q);
      const statusMatch =
        statusFilter === 'all' ||
        (statusFilter === 'todo' && todoDungeonIds.has(d.id)) ||
        (statusFilter === 'done' && doneDungeonIds.has(d.id));
      const doneMatch = !hideDone || !doneDungeonIds.has(d.id);
      return nameMatch && statusMatch && doneMatch;
    });
  }, [dungeons, search, statusFilter, hideDone, todoDungeonIds, doneDungeonIds]);

  return (
    <div style={{ padding: 0 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Filters */}
        <Card size="small" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Row gutter={16} align="middle">
              <Col xs={24} md={12}>
                <Search
                  placeholder="Rechercher un donjon..."
                  allowClear
                  prefix={<SearchOutlined />}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Col>
            </Row>

            {selectedCharacterId && (
              <Row align="middle" gutter={16}>
                <Col>
                  <Radio.Group
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                  >
                    <Radio.Button value="all">Tous ({dungeons.length})</Radio.Button>
                    <Radio.Button value="todo">
                      <BookOutlined style={{ marginRight: 4 }} />
                      À faire ({todoDungeonIds.size})
                    </Radio.Button>
                    <Radio.Button value="done">
                      <CheckCircleOutlined style={{ marginRight: 4 }} />
                      Faits ({doneDungeonIds.size})
                    </Radio.Button>
                  </Radio.Group>
                </Col>
                <Col>
                  <Tooltip title="Masquer les donjons déjà faits">
                    <Space size={6}>
                      <Switch
                        size="small"
                        checked={hideDone}
                        onChange={setHideDone}
                        checkedChildren={<EyeInvisibleOutlined />}
                        unCheckedChildren={<EyeOutlined />}
                      />
                      <Text type="secondary" style={{ fontSize: 12 }}>Masquer les faits</Text>
                    </Space>
                  </Tooltip>
                </Col>
              </Row>
            )}
          </Space>
        </Card>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : filtered.length === 0 ? (
          <Empty description="Aucun donjon trouvé" />
        ) : (
          <>
            <Text type="secondary">{filtered.length} donjon{filtered.length > 1 ? 's' : ''}</Text>
            <Row gutter={[12, 12]}>
              {filtered.map((dungeon) => (
                <Col key={dungeon.id} xs={24} sm={12} lg={8} xl={6}>
                  <DungeonCard
                    dungeon={dungeon}
                    characterId={selectedCharacterId}
                    isTodo={todoDungeonIds.has(dungeon.id)}
                    isDone={doneDungeonIds.has(dungeon.id)}
                    onToggleTodo={() => selectedCharacterId && setDungeonStatus(selectedCharacterId, dungeon.id, { isTodo: !todoDungeonIds.has(dungeon.id) })}
                    onToggleDone={() => selectedCharacterId && setDungeonStatus(selectedCharacterId, dungeon.id, { isDone: !doneDungeonIds.has(dungeon.id) })}
                  />
                </Col>
              ))}
            </Row>
          </>
        )}
      </Space>
    </div>
  );
}

function DungeonCard({
  dungeon,
  characterId,
  isTodo,
  isDone,
  onToggleTodo,
  onToggleDone,
}: {
  dungeon: Dungeon;
  characterId: string | null;
  isTodo: boolean;
  isDone: boolean;
  onToggleTodo: () => void;
  onToggleDone: () => void;
}) {
  const topColor = statusBorderColor(characterId, isTodo, isDone);
  const levelColor = levelTagColor(dungeon.level);

  return (
    <Card
      size="small"
      hoverable
      style={{ height: '100%', borderTop: `3px solid ${topColor}` }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Name + level badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <Text strong style={{ fontSize: 13, lineHeight: '18px', flex: 1 }}>
            {dungeon.name.fr}
          </Text>
          {dungeon.level > 0 && (
            <Tag
              style={{
                background: levelColor,
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              Niv. {dungeon.level}
            </Tag>
          )}
        </div>

        <Divider style={{ margin: '0' }} />

        {/* Bottom row: monsters + action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {(dungeon.monsterIds?.length ?? 0) > 0 ? (
            <Tooltip title="Nombre de monstres différents">
              <Space size={4}>
                <BugOutlined style={{ color: '#aaa', fontSize: 13 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dungeon.monsterIds.length} monstre{dungeon.monsterIds.length > 1 ? 's' : ''}
                </Text>
              </Space>
            </Tooltip>
          ) : <span />}

          {characterId && (
            <Space size={4}>
              <Tooltip title={isTodo ? 'Retirer de "À faire"' : 'Marquer comme "À faire"'}>
                <Button
                  size="small"
                  type={isTodo ? 'primary' : 'default'}
                  icon={<BookOutlined />}
                  onClick={onToggleTodo}
                  style={isTodo ? { background: '#ff4d4f', borderColor: '#ff4d4f' } : {}}
                />
              </Tooltip>
              <Tooltip title={isDone ? 'Marquer comme non fait' : 'Marquer comme fait'}>
                <Button
                  size="small"
                  type={isDone ? 'primary' : 'default'}
                  icon={<CheckCircleOutlined />}
                  onClick={onToggleDone}
                  style={isDone ? { background: '#52c41a', borderColor: '#52c41a' } : {}}
                />
              </Tooltip>
            </Space>
          )}
        </div>
      </div>
    </Card>
  );
}
