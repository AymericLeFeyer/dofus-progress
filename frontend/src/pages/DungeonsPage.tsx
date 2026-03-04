import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Col,
  Row,
  Slider,
  Input,
  Tag,
  Typography,
  Spin,
  Empty,
  Space,
  Statistic,
  Tooltip,
  Divider,
} from 'antd';
import {
  FireOutlined,
  SearchOutlined,
  BugOutlined,
  CompassOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import type { Dungeon } from '../types/dofusdb';
import { dofusdbService } from '../services/dofusdb.service';

const { Text } = Typography;
const { Search } = Input;

function levelTagColor(level: number): string {
  if (level >= 190) return '#722ed1';
  if (level >= 150) return '#f5222d';
  if (level >= 100) return '#fa8c16';
  if (level >= 50) return '#1677ff';
  return '#52c41a';
}

export function DungeonsPage() {
  const [dungeons, setDungeons] = useState<Dungeon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [levelRange, setLevelRange] = useState<[number, number]>([1, 200]);

  useEffect(() => {
    dofusdbService.getAllDungeons().then((data) => {
      setDungeons(data);
      if (data.length > 0) {
        const levels = data.map((d) => d.level).filter(Boolean);
        setLevelRange([Math.min(...levels), Math.max(...levels)]);
      }
      setLoading(false);
    });
  }, []);

  const allLevels = useMemo(() => dungeons.map((d) => d.level).filter(Boolean), [dungeons]);
  const minLevel = allLevels.length ? Math.min(...allLevels) : 1;
  const maxLevel = allLevels.length ? Math.max(...allLevels) : 200;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return dungeons.filter((d) => {
      const nameMatch = !q || d.name.fr.toLowerCase().includes(q);
      const levelMatch = !d.level || (d.level >= levelRange[0] && d.level <= levelRange[1]);
      return nameMatch && levelMatch;
    });
  }, [dungeons, search, levelRange]);

  // Group by level bracket
  const brackets = [
    { label: 'Niv. 1–50', min: 1, max: 50, color: '#52c41a' },
    { label: 'Niv. 51–100', min: 51, max: 100, color: '#1677ff' },
    { label: 'Niv. 101–150', min: 101, max: 150, color: '#fa8c16' },
    { label: 'Niv. 151–190', min: 151, max: 190, color: '#f5222d' },
    { label: 'Niv. 191–200', min: 191, max: 200, color: '#722ed1' },
  ];
  const counts = brackets.map((b) => ({
    ...b,
    count: dungeons.filter((d) => d.level >= b.min && d.level <= b.max).length,
  }));

  return (
    <div style={{ padding: 0 }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Header stats */}
        <Row gutter={12}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ background: '#fff7e6', border: '1px solid #ffd591' }}>
              <Statistic
                title={<Text style={{ fontSize: 12 }}>Total donjons</Text>}
                value={dungeons.length}
                prefix={<CompassOutlined />}
                valueStyle={{ color: '#c0902b', fontSize: 20 }}
              />
            </Card>
          </Col>
          {counts.slice(0, 4).map((b) => (
            <Col xs={12} sm={6} key={b.label}>
              <Card size="small">
                <Statistic
                  title={<Text style={{ fontSize: 12 }}>{b.label}</Text>}
                  value={b.count}
                  valueStyle={{ color: b.color, fontSize: 20 }}
                />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Filters */}
        <Card size="small" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <Row gutter={24} align="middle">
            <Col xs={24} md={10}>
              <Search
                placeholder="Rechercher un donjon..."
                allowClear
                prefix={<SearchOutlined />}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Col>
            <Col xs={24} md={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Space style={{ flexShrink: 0 }}>
                  <FilterOutlined />
                  <Text style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Niveau :</Text>
                </Space>
                <Slider
                  range
                  min={minLevel || 1}
                  max={maxLevel || 200}
                  value={levelRange}
                  onChange={(v) => setLevelRange(v as [number, number])}
                  marks={{ [minLevel || 1]: minLevel || 1, [maxLevel || 200]: maxLevel || 200 }}
                  tooltip={{ formatter: (v) => `Niv. ${v}` }}
                  style={{ flex: 1 }}
                />
                <Tag style={{ flexShrink: 0 }}>
                  {levelRange[0]}–{levelRange[1]}
                </Tag>
              </div>
            </Col>
          </Row>
        </Card>

        {/* Results */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : filtered.length === 0 ? (
          <Empty description="Aucun donjon trouvé" />
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">{filtered.length} donjon{filtered.length > 1 ? 's' : ''}</Text>
              <Space>
                {brackets.map((b) => (
                  <Tooltip key={b.label} title={b.label}>
                    <span
                      style={{ width: 12, height: 12, borderRadius: '50%', background: b.color, display: 'inline-block', cursor: 'help' }}
                    />
                  </Tooltip>
                ))}
                <Text type="secondary" style={{ fontSize: 12 }}>= tranches de niveaux</Text>
              </Space>
            </div>
            <Row gutter={[12, 12]}>
              {filtered.map((dungeon) => (
                <Col key={dungeon.id} xs={24} sm={12} lg={8} xl={6}>
                  <DungeonCard dungeon={dungeon} />
                </Col>
              ))}
            </Row>
          </>
        )}
      </Space>
    </div>
  );
}

function DungeonCard({ dungeon }: { dungeon: Dungeon }) {
  const color = levelTagColor(dungeon.level);

  return (
    <Card
      size="small"
      hoverable
      style={{ height: '100%', borderTop: `3px solid ${color}` }}
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
                background: color,
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: 12,
                flexShrink: 0,
              }}
            >
              {dungeon.level}
            </Tag>
          )}
        </div>

        <Divider style={{ margin: '0' }} />

        {/* Stats */}
        <div style={{ display: 'flex', gap: 16 }}>
          <Tooltip title="Nombre de monstres différents">
            <Space size={4}>
              <BugOutlined style={{ color: '#aaa', fontSize: 13 }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dungeon.monsterIds.length} monstre{dungeon.monsterIds.length > 1 ? 's' : ''}
              </Text>
            </Space>
          </Tooltip>
          {dungeon.mapIds?.length > 0 && (
            <Tooltip title="Nombre de cartes">
              <Space size={4}>
                <CompassOutlined style={{ color: '#aaa', fontSize: 13 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dungeon.mapIds.length} carte{dungeon.mapIds.length > 1 ? 's' : ''}
                </Text>
              </Space>
            </Tooltip>
          )}
        </div>

        {/* Level label */}
        <div style={{ display: 'flex', gap: 4 }}>
          <Tag icon={<FireOutlined />} color={dungeon.level >= 150 ? 'error' : dungeon.level >= 100 ? 'warning' : 'success'} style={{ fontSize: 11, margin: 0 }}>
            {dungeon.level <= 50 ? 'Débutant' : dungeon.level <= 100 ? 'Intermédiaire' : dungeon.level <= 150 ? 'Avancé' : dungeon.level <= 190 ? 'Expert' : 'Maître'}
          </Tag>
        </div>
      </div>
    </Card>
  );
}
