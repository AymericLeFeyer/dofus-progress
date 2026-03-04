export enum CharacterClass {
  FECA = 'Féca',
  OSAMODAS = 'Osamodas',
  ENUTROF = 'Enutrof',
  SRAM = 'Sram',
  XELOR = 'Xélor',
  ECAFLIP = 'Ecaflip',
  ENIRIPSA = 'Eniripsa',
  IOP = 'Iop',
  CRA = 'Cra',
  SADIDA = 'Sadida',
  SACRIEUR = 'Sacrieur',
  PANDAWA = 'Pandawa',
  ROUBLARD = 'Roublard',
  ZOBAL = 'Zobal',
  STEAMER = 'Steamer',
  ELIOTROPE = 'Eliotrope',
  HUPPERMAGE = 'Huppermage',
  OUGINAK = 'Ouginak',
  FORGELANCE = 'Forgelance',
}

export const CHARACTER_CLASSES = Object.values(CharacterClass);

export class Character {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly characterClass: CharacterClass,
    public readonly level: number,
    public readonly createdAt: Date,
  ) {}

  isValidLevel(): boolean {
    return this.level >= 1 && this.level <= 200;
  }
}

export interface CreateCharacterData {
  userId: string;
  name: string;
  characterClass: CharacterClass;
  level: number;
}

export interface UpdateCharacterData {
  name?: string;
  characterClass?: CharacterClass;
  level?: number;
}
