import { useState } from 'react';
import { Avatar, Badge, Button, Card, List, Space, Typography, message } from 'antd';
import { CheckOutlined, CloseOutlined, MailOutlined, MinusOutlined } from '@ant-design/icons';
import { useGuildStore } from '../../stores/guildStore';
import { useCharacterStore } from '../../stores/characterStore';
import { GuildInvitation } from '../../types';
import { AxiosError } from 'axios';

const { Text } = Typography;

export function InvitationsFloat() {
  const { invitations, acceptInvitation, declineInvitation } = useGuildStore();
  const { fetchCharacters } = useCharacterStore();
  const [collapsed, setCollapsed] = useState(false);

  if (invitations.length === 0) return null;

  const handleAccept = async (inv: GuildInvitation) => {
    try {
      await acceptInvitation(inv.token);
      await fetchCharacters();
      message.success(`Vous avez rejoint ${inv.guild.name} !`);
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  const handleDecline = async (inv: GuildInvitation) => {
    try {
      await declineInvitation(inv.token);
      message.info('Invitation refusée');
    } catch (err) {
      const msg = err instanceof AxiosError ? err.response?.data?.error : 'Erreur';
      message.error(msg);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 1000,
        width: collapsed ? 'auto' : 340,
      }}
    >
      {collapsed ? (
        <Badge count={invitations.length} size="default">
          <Button
            type="primary"
            shape="circle"
            icon={<MailOutlined />}
            size="large"
            onClick={() => setCollapsed(false)}
            style={{ background: '#c0902b', borderColor: '#c0902b', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
          />
        </Badge>
      ) : (
        <Card
          size="small"
          style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
          title={
            <Space>
              <MailOutlined style={{ color: '#c0902b' }} />
              <Text strong>Invitations de guilde</Text>
              <Badge count={invitations.length} style={{ backgroundColor: '#c0902b' }} />
            </Space>
          }
          extra={
            <Button
              type="text"
              icon={<MinusOutlined />}
              size="small"
              onClick={() => setCollapsed(true)}
            />
          }
        >
          <List
            size="small"
            dataSource={invitations}
            renderItem={(inv) => (
              <List.Item style={{ padding: '8px 0' }}>
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    {inv.guild.imageUrl ? (
                      <Avatar src={inv.guild.imageUrl} size={32} />
                    ) : (
                      <Avatar size={32} style={{ background: '#c0902b', fontSize: 12 }}>
                        {inv.guild.name.charAt(0)}
                      </Avatar>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ fontSize: 13 }}>{inv.guild.name}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Pour {inv.character.name}
                      </Text>
                    </div>
                  </div>
                  <Space size={6}>
                    <Button
                      size="small"
                      type="primary"
                      icon={<CheckOutlined />}
                      onClick={() => handleAccept(inv)}
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                      Accepter
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<CloseOutlined />}
                      onClick={() => handleDecline(inv)}
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
    </div>
  );
}
