export interface DefaultModel {
  id: string;
  name: string;
  fileName: string;
  path: string;
  icon: string;
  category: 'furniture' | 'nature' | 'architecture' | 'objects';
}

export const defaultModelCategories: Record<string, { name: string; icon: string }> = {
  furniture: { name: 'Mobilier', icon: '🪑' },
  nature: { name: 'Nature', icon: '🌳' },
  architecture: { name: 'Architecture', icon: '🏠' },
  objects: { name: 'Objets', icon: '⚔️' },
};

export const defaultModels: DefaultModel[] = [
  {
    id: 'default-table',
    name: 'Table',
    fileName: 'table.obj',
    path: '/models/table.obj',
    icon: '🪑',
    category: 'furniture',
  },
  {
    id: 'default-chair',
    name: 'Chaise',
    fileName: 'chair.obj',
    path: '/models/chair.obj',
    icon: '💺',
    category: 'furniture',
  },
  {
    id: 'default-tree',
    name: 'Arbre',
    fileName: 'tree.obj',
    path: '/models/tree.obj',
    icon: '🌳',
    category: 'nature',
  },
  {
    id: 'default-mushroom',
    name: 'Champignon',
    fileName: 'mushroom.obj',
    path: '/models/mushroom.obj',
    icon: '🍄',
    category: 'nature',
  },
  {
    id: 'default-house',
    name: 'Maison',
    fileName: 'house.obj',
    path: '/models/house.obj',
    icon: '🏠',
    category: 'architecture',
  },
  {
    id: 'default-diamond',
    name: 'Diamant',
    fileName: 'diamond.obj',
    path: '/models/diamond.obj',
    icon: '💎',
    category: 'objects',
  },
  {
    id: 'default-boat',
    name: 'Bateau',
    fileName: 'boat.obj',
    path: '/models/boat.obj',
    icon: '⛵',
    category: 'objects',
  },
  {
    id: 'default-sword',
    name: 'Épée',
    fileName: 'sword.obj',
    path: '/models/sword.obj',
    icon: '⚔️',
    category: 'objects',
  },
];

export const getDefaultModelsByCategory = (category: string) => {
  return defaultModels.filter((m) => m.category === category);
};
