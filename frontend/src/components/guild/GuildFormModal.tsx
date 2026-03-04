import { useEffect } from 'react';
import { Modal, Form, Input, Select } from 'antd';
import { Character, CreateGuildData } from '../../types';

interface Props {
  open: boolean;
  eligibleCharacters: Character[];
  onSubmit: (data: CreateGuildData) => Promise<void>;
  onCancel: () => void;
}

export function GuildFormModal({ open, eligibleCharacters, onSubmit, onCancel }: Props) {
  const [form] = Form.useForm<CreateGuildData>();

  useEffect(() => {
    if (!open) form.resetFields();
  }, [open, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      title="Créer une guilde"
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel(); }}
      okText="Créer"
      cancelText="Annuler"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Nom de la guilde" rules={[{ required: true, min: 2, max: 30, message: 'Entre 2 et 30 caractères' }]}>
          <Input placeholder="Ex: Les Gardiens du Krosmoz" />
        </Form.Item>

        <Form.Item name="leaderCharacterId" label="Chef de guilde" rules={[{ required: true, message: 'Sélectionnez un personnage' }]}>
          <Select placeholder="Choisir un personnage">
            {eligibleCharacters.map((c) => (
              <Select.Option key={c.id} value={c.id}>
                {c.name} ({c.characterClass}) — Niv. {c.level}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="imageUrl" label="URL de l'image (optionnel)" rules={[{ type: 'url', message: 'URL invalide' }]}>
          <Input placeholder="https://..." />
        </Form.Item>
      </Form>
    </Modal>
  );
}
