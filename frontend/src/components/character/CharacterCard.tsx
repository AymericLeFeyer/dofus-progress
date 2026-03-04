import { Card, Tag, Space, Button, Popconfirm, Typography, Tooltip } from 'antd';
import { EditOutlined, DeleteOutlined, TeamOutlined, TrophyOutlined } from '@ant-design/icons';
import { Character } from '../../types';

const { Text } = Typography;

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  leader: { label: 'Chef', color: 'gold' },
  officer: { label: 'Officier', color: 'blue' },
  member: { label: 'Membre', color: 'default' },
};

interface Props {
  character: Character;
  achievementPoints?: number;
  onEdit: (character: Character) => void;
  onDelete: (id: string) => void;
}

export function CharacterCard({ character, achievementPoints, onEdit, onDelete }: Props) {
  const roleInfo = character.guildMember ? ROLE_LABELS[character.guildMember.role] : null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <Text strong>{character.name}</Text>
          <Tag color="orange">{character.characterClass}</Tag>
          <Tag>Niv. {character.level}</Tag>
        </Space>
      }
      extra={
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => onEdit(character)} />
          <Popconfirm
            title="Supprimer ce personnage ?"
            description="Cette action est irréversible."
            onConfirm={() => onDelete(character.id)}
            okText="Supprimer"
            cancelText="Annuler"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger />
          </Popconfirm>
        </Space>
      }
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {character.guildMember ? (
          <Space>
            <TeamOutlined />
            <Text>{character.guildMember.guild.name}</Text>
            {roleInfo && <Tag color={roleInfo.color}>{roleInfo.label}</Tag>}
          </Space>
        ) : (
          <Text type="secondary">Sans guilde</Text>
        )}
        {achievementPoints !== undefined && achievementPoints > 0 && (
          <Tooltip title="Points de succès">
            <Tag icon={<TrophyOutlined />} color="gold" style={{ marginLeft: 8 }}>
              {achievementPoints} pts
            </Tag>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}
