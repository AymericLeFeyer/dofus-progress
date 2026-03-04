import { useEffect } from 'react';
import { Modal, Form, Input, Select, InputNumber } from 'antd';
import { Character, CreateCharacterData } from '../../types';

interface Props {
  open: boolean;
  character?: Character | null;
  classes: string[];
  onSubmit: (data: CreateCharacterData) => Promise<void>;
  onCancel: () => void;
}

export function CharacterFormModal({ open, character, classes, onSubmit, onCancel }: Props) {
  const [form] = Form.useForm<CreateCharacterData>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue(
        character
          ? { name: character.name, characterClass: character.characterClass, level: character.level }
          : { level: 1 },
      );
    }
  }, [open, character, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
    form.resetFields();
  };

  return (
    <Modal
      title={character ? 'Modifier le personnage' : 'Créer un personnage'}
      open={open}
      onOk={handleOk}
      onCancel={() => { form.resetFields(); onCancel(); }}
      okText={character ? 'Modifier' : 'Créer'}
      cancelText="Annuler"
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="Nom" rules={[{ required: true, min: 2, max: 20, message: 'Entre 2 et 20 caractères' }]}>
          <Input placeholder="Nom du personnage" />
        </Form.Item>

        <Form.Item name="characterClass" label="Classe" rules={[{ required: true, message: 'Sélectionnez une classe' }]}>
          <Select placeholder="Choisir une classe" showSearch>
            {classes.map((cls) => (
              <Select.Option key={cls} value={cls}>{cls}</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="level" label="Niveau" rules={[{ required: true, type: 'number', min: 1, max: 200 }]}>
          <InputNumber min={1} max={200} style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
