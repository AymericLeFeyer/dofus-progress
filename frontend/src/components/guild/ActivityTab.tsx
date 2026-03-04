import { useState, useEffect, useMemo } from 'react';
import {
  Select, Checkbox, Button, Card, Tag, Space, Typography,
  Spin, Row, Col, Empty, Tooltip,
} from 'antd';
import {
  ThunderboltOutlined, BookOutlined, TrophyOutlined,
  ReloadOutlined, CompassOutlined,
} from '@ant-design/icons';
import type { GuildMemberProgress } from '../../services/progress.service';
import { dofusdbService, levelRange, pointsColor } from '../../services/dofusdb.service';
import type { Dungeon, Achievement } from '../../types/dofusdb';
import { ClassAvatar } from '../character/ClassAvatar';

const { Text } = Typography;

type ActivityType = 'quests' | 'dungeons' | 'achievements';

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

type TagDef = { label: string; color?: string; icon?: React.ReactNode };

type Suggestions = {
  quests?: QuestStub[];
  dungeons?: Dungeon[];
  achievements?: Achievement[];
};

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

function MemberAvatars({ members }: { members: GuildMemberProgress[] }) {
  if (!members.length) return null;
  return (
    <Space size={4}>
      {members.map((m) => (
        <Tooltip key={m.characterId} title={m.name}>
          <span><ClassAvatar className={m.class} size={20} /></span>
        </Tooltip>
      ))}
    </Space>
  );
}

function SuggestionItem({
  title, tags, members, imgUrl,
}: {
  title: string;
  tags: TagDef[];
  members: GuildMemberProgress[];
  imgUrl?: string;
}) {
  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 6,
      border: '1px solid rgba(0,0,0,0.08)',
      background: 'rgba(0,0,0,0.02)',
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      {imgUrl && (
        <img
          src={imgUrl}
          width={40}
          height={40}
          style={{ borderRadius: 6, objectFit: 'contain', background: '#f5f5f5', flexShrink: 0 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      )}
      <Space direction="vertical" size={6} style={{ width: '100%', flex: 1 }}>
        <Text strong style={{ fontSize: 13 }}>{title}</Text>
        {tags.length > 0 && (
          <Space size={4} wrap>
            {tags.map((tag, i) => (
              <Tag key={i} color={tag.color} icon={tag.icon} style={{ fontSize: 11, marginRight: 0 }}>
                {tag.label}
              </Tag>
            ))}
          </Space>
        )}
        <MemberAvatars members={members} />
      </Space>
    </div>
  );
}

interface Props {
  guildProgress: GuildMemberProgress[];
  dungeonMap: Map<number, Dungeon>;
  catNames: Record<number, string>;
}

export function ActivityTab({ guildProgress, dungeonMap, catNames }: Props) {
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<ActivityType[]>([]);
  const [beneficialToAll, setBeneficialToAll] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);
  const [loading, setLoading] = useState(false);
  const [achCatNames, setAchCatNames] = useState<Record<number, string>>({});
  const [allQuests, setAllQuests] = useState<QuestStub[]>([]);
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([]);

  useEffect(() => {
    dofusdbService.getAllAchievementCategories().then((cats) => {
      const m: Record<number, string> = {};
      cats.forEach((c) => { m[c.id] = c.name.fr; });
      setAchCatNames(m);
    }).catch(() => {});

    dofusdbService.getAllQuests().then((qs) => setAllQuests(qs as QuestStub[])).catch(() => {});
    dofusdbService.getAllAchievements().then(setAllAchievements).catch(() => {});
  }, []);

  const selectedMembers = guildProgress.filter((mp) => selectedMemberIds.includes(mp.characterId));

  // Use Sets for O(1) lookup on completed arrays
  const completedQuestSets = useMemo(() =>
    new Map(guildProgress.map((mp) => [mp.characterId, new Set(mp.completedQuestIds)])),
    [guildProgress],
  );
  const completedAchSets = useMemo(() =>
    new Map(guildProgress.map((mp) => [mp.characterId, new Set(mp.completedAchievementIds)])),
    [guildProgress],
  );
  const doneDungeonSets = useMemo(() =>
    new Map(guildProgress.map((mp) => [mp.characterId, new Set(mp.doneDungeonIds ?? [])])),
    [guildProgress],
  );
  const todoDungeonSets = useMemo(() =>
    new Map(guildProgress.map((mp) => [mp.characterId, new Set(mp.todoDungeonIds ?? [])])),
    [guildProgress],
  );

  const memberNeedsQuest = (mp: GuildMemberProgress, id: number) =>
    !completedQuestSets.get(mp.characterId)?.has(id);

  const memberNeedsDungeon = (mp: GuildMemberProgress, id: number) =>
    todoDungeonSets.get(mp.characterId)?.has(id) || !doneDungeonSets.get(mp.characterId)?.has(id);

  const memberNeedsAchievement = (mp: GuildMemberProgress, id: number) =>
    !completedAchSets.get(mp.characterId)?.has(id);

  function applyFilter<T>(
    items: T[],
    getId: (item: T) => number,
    needs: (mp: GuildMemberProgress, id: number) => boolean,
  ): T[] {
    if (!selectedMembers.length) return [];
    return items.filter((item) => {
      const id = getId(item);
      return beneficialToAll
        ? selectedMembers.every((mp) => needs(mp, id))
        : selectedMembers.some((mp) => needs(mp, id));
    });
  }

  function getMembersForItem(id: number, needs: (mp: GuildMemberProgress, id: number) => boolean) {
    return selectedMembers.filter((mp) => needs(mp, id));
  }

  async function generate() {
    if (!selectedMemberIds.length || !selectedTypes.length) return;
    setLoading(true);
    try {
      const result: Suggestions = {};

      if (selectedTypes.includes('quests')) {
        const pool = applyFilter(allQuests, (q) => q.id, memberNeedsQuest);
        result.quests = shuffle(pool).slice(0, 3);
      }

      if (selectedTypes.includes('dungeons')) {
        const pool = applyFilter([...dungeonMap.values()], (d) => d.id, memberNeedsDungeon);
        result.dungeons = shuffle(pool).slice(0, 3);
      }

      if (selectedTypes.includes('achievements')) {
        const pool = applyFilter(allAchievements, (a) => a.id, memberNeedsAchievement);
        result.achievements = shuffle(pool).slice(0, 3);
      }

      setSuggestions(result);
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = selectedMemberIds.length > 0 && selectedTypes.length > 0;
  const typeCount = selectedTypes.length;
  const dataLoaded = allQuests.length > 0 && allAchievements.length > 0;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '16px 0 60px' }}>
      {/* Configuration */}
      <Card size="small">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* Participants */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Participants</Text>
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              placeholder="Sélectionner les membres participants..."
              value={selectedMemberIds}
              onChange={setSelectedMemberIds}
              tagRender={(props) => {
                const member = guildProgress.find((mp) => mp.characterId === props.value);
                return (
                  <Tag
                    closable
                    onClose={props.onClose}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 4 }}
                  >
                    {member && <ClassAvatar className={member.class} size={14} />}
                    <span>{props.label}</span>
                  </Tag>
                );
              }}
              options={guildProgress.map((mp) => ({
                value: mp.characterId,
                label: mp.name,
                memberClass: mp.class,
              }))}
              optionRender={(option) => (
                <Space size={8}>
                  <ClassAvatar className={(option.data as { memberClass: string }).memberClass} size={20} />
                  <span>{option.label}</span>
                </Space>
              )}
            />
          </div>

          {/* Type d'activité */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>Type d'activité</Text>
            <Checkbox.Group
              value={selectedTypes}
              onChange={(vals) => setSelectedTypes(vals as ActivityType[])}
            >
              <Space size={16} wrap>
                <Checkbox value="dungeons">
                  <Space size={4}>
                    <CompassOutlined style={{ color: '#c0902b' }} />
                    <span>Donjons</span>
                  </Space>
                </Checkbox>
                <Checkbox value="quests">
                  <Space size={4}>
                    <BookOutlined style={{ color: '#1677ff' }} />
                    <span>Quêtes</span>
                  </Space>
                </Checkbox>
                <Checkbox value="achievements">
                  <Space size={4}>
                    <TrophyOutlined style={{ color: '#c0902b' }} />
                    <span>Succès</span>
                  </Space>
                </Checkbox>
              </Space>
            </Checkbox.Group>
          </div>

          {/* Bénéfique à tous */}
          <Checkbox
            checked={beneficialToAll}
            onChange={(e) => setBeneficialToAll(e.target.checked)}
          >
            <span>Bénéfique à tous les participants</span>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
              — tous les membres sélectionnés doivent en avoir besoin
            </Text>
          </Checkbox>

          <Button
            type="primary"
            icon={suggestions ? <ReloadOutlined /> : <TrophyOutlined />}
            onClick={generate}
            disabled={!canGenerate || !dataLoaded}
            loading={loading || (!dataLoaded && selectedTypes.length > 0)}
            style={{ background: '#c0902b', borderColor: '#c0902b' }}
          >
            {!dataLoaded ? 'Chargement des données...' : suggestions ? 'Relancer' : 'Générer des suggestions'}
          </Button>
        </Space>
      </Card>

      {/* Résultats */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && suggestions && (
        <Row gutter={[16, 16]}>
          {/* Quêtes */}
          {selectedTypes.includes('quests') && (
            <Col xs={24} md={typeCount === 2 ? 12 : 24} xl={typeCount === 3 ? 8 : typeCount === 2 ? 12 : 24}>
              <Card
                size="small"
                title={<Space><BookOutlined style={{ color: '#1677ff' }} /><span>Quêtes</span></Space>}
                style={{ borderTop: '3px solid #1677ff', height: '100%' }}
              >
                {!suggestions.quests?.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune quête disponible" />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {suggestions.quests.map((quest) => (
                      <SuggestionItem
                        key={quest.id}
                        title={quest.name.fr}
                        tags={[
                          catNames[quest.categoryId] ? { label: catNames[quest.categoryId] } : null,
                          levelRange(quest.levelMin, quest.levelMax) ? { label: levelRange(quest.levelMin, quest.levelMax), color: 'orange' } : null,
                          quest.isDungeonQuest ? { label: 'Donjon', color: 'volcano', icon: <ThunderboltOutlined /> } : null,
                          quest.isPartyQuest ? { label: 'Groupe', color: 'purple' } : null,
                          quest.isEvent ? { label: 'Événement', color: 'cyan' } : null,
                        ].filter(Boolean) as TagDef[]}
                        members={getMembersForItem(quest.id, memberNeedsQuest)}
                      />
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          )}

          {/* Donjons */}
          {selectedTypes.includes('dungeons') && (
            <Col xs={24} md={typeCount === 2 ? 12 : 24} xl={typeCount === 3 ? 8 : typeCount === 2 ? 12 : 24}>
              <Card
                size="small"
                title={<Space><CompassOutlined style={{ color: '#c0902b' }} /><span>Donjons</span></Space>}
                style={{ borderTop: '3px solid #c0902b', height: '100%' }}
              >
                {!suggestions.dungeons?.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun donjon disponible" />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {suggestions.dungeons.map((dungeon) => (
                      <SuggestionItem
                        key={dungeon.id}
                        title={dungeon.name.fr}
                        tags={[
                          dungeon.level > 0 ? { label: `Niv. ${dungeon.level}`, color: 'orange' } : null,
                        ].filter(Boolean) as TagDef[]}
                        members={getMembersForItem(dungeon.id, memberNeedsDungeon)}
                      />
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          )}

          {/* Succès */}
          {selectedTypes.includes('achievements') && (
            <Col xs={24} md={typeCount === 2 ? 12 : 24} xl={typeCount === 3 ? 8 : typeCount === 2 ? 12 : 24}>
              <Card
                size="small"
                title={<Space><TrophyOutlined style={{ color: '#c0902b' }} /><span>Succès</span></Space>}
                style={{ borderTop: '3px solid #f5c842', height: '100%' }}
              >
                {!suggestions.achievements?.length ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun succès disponible" />
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }} size={8}>
                    {suggestions.achievements.map((ach) => (
                      <SuggestionItem
                        key={ach.id}
                        title={ach.name.fr}
                        imgUrl={ach.img}
                        tags={[
                          achCatNames[ach.categoryId] ? { label: achCatNames[ach.categoryId] } : null,
                          ach.points > 0 ? { label: `${ach.points} pts`, color: pointsColor(ach.points) } : null,
                        ].filter(Boolean) as TagDef[]}
                        members={getMembersForItem(ach.id, memberNeedsAchievement)}
                      />
                    ))}
                  </Space>
                )}
              </Card>
            </Col>
          )}
        </Row>
      )}
    </Space>
  );
}
