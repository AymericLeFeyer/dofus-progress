import { useEffect } from 'react';
import { Card, List, Avatar, Button, Space, Typography, Tag, Empty, message } from 'antd';
import { TeamOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useGuildStore } from '../stores/guildStore';
import { GuildInvitation } from '../types';
import { AxiosError } from 'axios';
import { useCharacterStore } from '../stores/characterStore';

const { Title, Text } = Typography;

export function InvitationsPage() {
  const { invitations, fetchInvitations, acceptInvitation, declineInvitation } = useGuildStore();
  const { fetchCharacters } = useCharacterStore();

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const handleAccept = async (invitation: GuildInvitation) => {
    try {
      await acceptInvitation(invitation.token);
      await fetchCharacters(); // refresh characters with new guild info
      message.success(`Vous avez rejoint la guilde ${invitation.guild.name} !`);
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleDecline = async (invitation: GuildInvitation) => {
    try {
      await declineInvitation(invitation.token);
      message.info('Invitation refusée');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Title level={2} style={{ margin: 0 }}>Invitations de guilde</Title>

        <Card>
          {invitations.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Aucune invitation en attente"
            />
          ) : (
            <List
              dataSource={invitations}
              renderItem={(invitation) => (
                <List.Item
                  actions={[
                    <Button
                      key="accept"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => handleAccept(invitation)}
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                      Accepter
                    </Button>,
                    <Button
                      key="decline"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleDecline(invitation)}
                    >
                      Refuser
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={
                      invitation.guild.imageUrl ? (
                        <Avatar src={invitation.guild.imageUrl} size={48} />
                      ) : (
                        <Avatar icon={<TeamOutlined />} size={48} style={{ background: '#c0902b' }} />
                      )
                    }
                    title={
                      <Space>
                        <Text strong>{invitation.guild.name}</Text>
                        <Text type="secondary">invite</Text>
                        <Tag color="orange">{invitation.character.name}</Tag>
                      </Space>
                    }
                    description={
                      <Text type="secondary">
                        Expire le {new Date(invitation.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </Text>
                    }
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </Space>
    </div>
  );
}
