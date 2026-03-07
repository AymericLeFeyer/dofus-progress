import { useState, useEffect } from 'react';
import {
  Select, Checkbox, Button, Card, Tag, Space, Typography,
  Spin, Row, Col, Empty, Tooltip, InputNumber,
} from 'antd';
import {
  ThunderboltOutlined, BookOutlined, TrophyOutlined,
  ReloadOutlined, CompassOutlined, CheckOutlined,
} from '@ant-design/icons';
import type { GuildMemberProgress, GuildActivityResult, QuestActivity, AchievementActivity, DungeonActivity } from '../../services/progress.service';
import { progressService } from '../../services/progress.service';
import { dofusdbService, levelRange, pointsColor } from '../../services/dofusdb.service';
import type { Dungeon } from '../../types/dofusdb';
import { ClassAvatar } from '../character/ClassAvatar';
import { useCharacterStore } from '../../stores/characterStore';
import { useProgressStore } from '../../stores/progressStore';

const { Text } = Typography;

type ActivityType = 'quests' | 'dungeons' | 'achievements';

type TagDef = { label: string; color?: string; icon?: React.ReactNode };

type NeededByRef = { characterId: string; name: string; class: string };

function MemberAvatars({ members }: { members: NeededByRef[] }) {
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
  title, tags, neededBy, imgUrl, isValidated, onValidate, canValidate,
}: {
  title: string;
  tags: TagDef[];
  neededBy: NeededByRef[];
  imgUrl?: string;
  isValidated: boolean;
  canValidate: boolean;
  onValidate: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleValidate = async () => {
    setLoading(true);
    try { await onValidate(); } finally { setLoading(false); }
  };

  return (
    <div style={{
      padding: '10px 12px',
      borderRadius: 6,
      border: `1px solid ${isValidated ? '#b7eb8f' : 'rgba(0,0,0,0.08)'}`,
      background: isValidated ? '#f6ffed' : 'rgba(0,0,0,0.02)',
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
        <Text strong style={{ fontSize: 13, textDecoration: isValidated ? 'line-through' : undefined, color: isValidated ? '#52c41a' : undefined }}>{title}</Text>
        {tags.length > 0 && (
          <Space size={4} wrap>
            {tags.map((tag, i) => (
              <Tag key={i} color={tag.color} icon={tag.icon} style={{ fontSize: 11, marginRight: 0 }}>
                {tag.label}
              </Tag>
            ))}
          </Space>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <MemberAvatars members={neededBy} />
          {canValidate && (
            <Button
              size="small"
              icon={isValidated ? <CheckOutlined /> : undefined}
              loading={loading}
              onClick={handleValidate}
              disabled={isValidated}
              style={isValidated
                ? { fontSize: 11, background: '#f6ffed', borderColor: '#52c41a', color: '#52c41a' }
                : { fontSize: 11, background: '#c0902b', borderColor: '#c0902b', color: '#fff' }
              }
            >
              {isValidated ? 'Validé' : 'Valider'}
            </Button>
          )}
        </div>
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
  const [suggestions, setSuggestions] = useState<GuildActivityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(3);
  const [achCatNames, setAchCatNames] = useState<Record<number, string>>({});

  const { selectedCharacterId } = useCharacterStore();
  const {
    completedQuestIds, completedAchievementIds, doneDungeonIds,
    setQuestStatus, toggleAchievement, setDungeonStatus,
  } = useProgressStore();

  useEffect(() => {
    dofusdbService.getAllAchievementCategories().then((cats) => {
      const m: Record<number, string> = {};
      cats.forEach((c) => { m[c.id] = c.name.fr; });
      setAchCatNames(m);
    }).catch(() => {});
  }, []);

  async function generate() {
    if (!selectedMemberIds.length || !selectedTypes.length) return;
    setLoading(true);
    try {
      const result = await progressService.getGuildActivity({
        characterIds: selectedMemberIds,
        types: selectedTypes,
        beneficialToAll,
        count,
        allDungeonIds: [...dungeonMap.keys()],
      });
      setSuggestions(result);
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = selectedMemberIds.length > 0 && selectedTypes.length > 0;
  const typeCount = selectedTypes.length;

  const questSection = (quests: QuestActivity[]) => (
    <Col xs={24} md={typeCount === 2 ? 12 : 24} xl={typeCount === 3 ? 8 : typeCount === 2 ? 12 : 24}>
      <Card
        size="small"
        title={<Space><BookOutlined style={{ color: '#1677ff' }} /><span>Quêtes</span></Space>}
        style={{ borderTop: '3px solid #1677ff', height: '100%' }}
      >
        {!quests.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucune quête disponible" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {quests.map((quest) => (
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
                neededBy={quest.neededBy}
                isValidated={completedQuestIds.has(quest.id)}
                canValidate={!!selectedCharacterId}
                onValidate={() => setQuestStatus(selectedCharacterId!, quest.id, 'completed')}
              />
            ))}
          </Space>
        )}
      </Card>
    </Col>
  );

  const dungeonSection = (dungeons: DungeonActivity[]) => (
    <Col xs={24} md={typeCount === 2 ? 12 : 24} xl={typeCount === 3 ? 8 : typeCount === 2 ? 12 : 24}>
      <Card
        size="small"
        title={<Space><CompassOutlined style={{ color: '#c0902b' }} /><span>Donjons</span></Space>}
        style={{ borderTop: '3px solid #c0902b', height: '100%' }}
      >
        {!dungeons.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun donjon disponible" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {dungeons.map((dungeon) => {
              const info = dungeonMap.get(dungeon.id);
              return (
                <SuggestionItem
                  key={dungeon.id}
                  title={info?.name.fr ?? `Donjon #${dungeon.id}`}
                  tags={[
                    info && info.level > 0 ? { label: `Niv. ${info.level}`, color: 'orange' } : null,
                  ].filter(Boolean) as TagDef[]}
                  neededBy={dungeon.neededBy}
                  isValidated={doneDungeonIds.has(dungeon.id)}
                  canValidate={!!selectedCharacterId}
                  onValidate={() => setDungeonStatus(selectedCharacterId!, dungeon.id, { isDone: true })}
                />
              );
            })}
          </Space>
        )}
      </Card>
    </Col>
  );

  const achievementSection = (achievements: AchievementActivity[]) => (
    <Col xs={24} md={typeCount === 2 ? 12 : 24} xl={typeCount === 3 ? 8 : typeCount === 2 ? 12 : 24}>
      <Card
        size="small"
        title={<Space><TrophyOutlined style={{ color: '#c0902b' }} /><span>Succès</span></Space>}
        style={{ borderTop: '3px solid #f5c842', height: '100%' }}
      >
        {!achievements.length ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Aucun succès disponible" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            {achievements.map((ach) => (
              <SuggestionItem
                key={ach.id}
                title={ach.name.fr}
                imgUrl={ach.img ?? undefined}
                tags={[
                  achCatNames[ach.categoryId] ? { label: achCatNames[ach.categoryId] } : null,
                  ach.points > 0 ? { label: `${ach.points} pts`, color: pointsColor(ach.points) } : null,
                ].filter(Boolean) as TagDef[]}
                neededBy={ach.neededBy}
                isValidated={completedAchievementIds.has(ach.id)}
                canValidate={!!selectedCharacterId && !completedAchievementIds.has(ach.id)}
                onValidate={() => toggleAchievement(selectedCharacterId!, ach.id)}
              />
            ))}
          </Space>
        )}
      </Card>
    </Col>
  );

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', padding: '16px 0 60px' }}>
      {/* Configuration */}
      <Card size="small">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
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

          <Checkbox
            checked={beneficialToAll}
            onChange={(e) => setBeneficialToAll(e.target.checked)}
          >
            <span>Bénéfique à tous les participants</span>
            <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
              — tous les membres sélectionnés doivent en avoir besoin
            </Text>
          </Checkbox>

          <Space align="center">
            <Text type="secondary" style={{ fontSize: 13 }}>Suggestions par type :</Text>
            <InputNumber
              min={1}
              max={10}
              value={count}
              onChange={(v) => setCount(v ?? 3)}
              size="small"
              style={{ width: 60 }}
            />
          </Space>

          <Button
            type="primary"
            icon={suggestions ? <ReloadOutlined /> : <TrophyOutlined />}
            onClick={generate}
            disabled={!canGenerate}
            loading={loading}
            style={{ background: '#c0902b', borderColor: '#c0902b' }}
          >
            {suggestions ? 'Relancer' : 'Générer des suggestions'}
          </Button>
        </Space>
      </Card>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      )}

      {!loading && suggestions && (
        <Row gutter={[16, 16]}>
          {selectedTypes.includes('quests') && suggestions.quests && questSection(suggestions.quests)}
          {selectedTypes.includes('dungeons') && suggestions.dungeons && dungeonSection(suggestions.dungeons)}
          {selectedTypes.includes('achievements') && suggestions.achievements && achievementSection(suggestions.achievements)}
        </Row>
      )}
    </Space>
  );
}
