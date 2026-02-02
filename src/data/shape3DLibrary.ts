import { Shape3DType } from '@/types/editor';

export interface LibraryShape3D {
  id: string;
  name: string;
  category: 'geometric' | 'architectural' | 'symbols' | 'everyday';
  type: Shape3DType;
  // For custom shapes, these define the extrusion path
  customGeometry?: {
    points: { x: number; y: number }[];
    depth: number;
    bevelEnabled?: boolean;
    bevelThickness?: number;
    bevelSize?: number;
  };
  icon: string; // Emoji or icon name
  defaultScale?: { width: number; height: number; depth: number };
}

export const shapeCategories = {
  geometric: { name: 'Formes géométriques', icon: '🔷' },
  architectural: { name: 'Formes architecturales', icon: '🏛️' },
  symbols: { name: 'Symboles/Icônes 3D', icon: '⭐' },
  everyday: { name: 'Objets du quotidien', icon: '🪑' },
};

export const shape3DLibrary: LibraryShape3D[] = [
  // ============ GEOMETRIC SHAPES ============
  {
    id: 'cube',
    name: 'Cube',
    category: 'geometric',
    type: 'cube',
    icon: '🧊',
  },
  {
    id: 'sphere',
    name: 'Sphère',
    category: 'geometric',
    type: 'sphere',
    icon: '🔵',
  },
  {
    id: 'cylinder',
    name: 'Cylindre',
    category: 'geometric',
    type: 'cylinder',
    icon: '🥫',
  },
  {
    id: 'cone',
    name: 'Cône',
    category: 'geometric',
    type: 'cone',
    icon: '🔺',
  },
  {
    id: 'torus',
    name: 'Tore',
    category: 'geometric',
    type: 'torus',
    icon: '⭕',
  },
  {
    id: 'pyramid',
    name: 'Pyramide',
    category: 'geometric',
    type: 'pyramid' as Shape3DType,
    icon: '🔺',
    customGeometry: {
      points: [
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 1, y: 1 },
        { x: -1, y: 1 },
      ],
      depth: 1,
    },
  },
  {
    id: 'octahedron',
    name: 'Octaèdre',
    category: 'geometric',
    type: 'octahedron' as Shape3DType,
    icon: '💎',
  },
  {
    id: 'dodecahedron',
    name: 'Dodécaèdre',
    category: 'geometric',
    type: 'dodecahedron' as Shape3DType,
    icon: '⬡',
  },
  {
    id: 'icosahedron',
    name: 'Icosaèdre',
    category: 'geometric',
    type: 'icosahedron' as Shape3DType,
    icon: '🔶',
  },
  {
    id: 'tetrahedron',
    name: 'Tétraèdre',
    category: 'geometric',
    type: 'tetrahedron' as Shape3DType,
    icon: '△',
  },
  {
    id: 'torusknot',
    name: 'Tore noué',
    category: 'geometric',
    type: 'torusknot' as Shape3DType,
    icon: '∞',
  },
  {
    id: 'capsule',
    name: 'Capsule',
    category: 'geometric',
    type: 'capsule' as Shape3DType,
    icon: '💊',
  },
  {
    id: 'ring',
    name: 'Anneau',
    category: 'geometric',
    type: 'ring' as Shape3DType,
    icon: '⭕',
  },
  {
    id: 'tube',
    name: 'Tube',
    category: 'geometric',
    type: 'tube' as Shape3DType,
    icon: '🔲',
  },

  // ============ ARCHITECTURAL SHAPES ============
  {
    id: 'column',
    name: 'Colonne',
    category: 'architectural',
    type: 'cylinder',
    icon: '🏛️',
    defaultScale: { width: 30, height: 150, depth: 30 },
  },
  {
    id: 'arch',
    name: 'Arche',
    category: 'architectural',
    type: 'arch' as Shape3DType,
    icon: '🌉',
    customGeometry: {
      points: [
        { x: -2, y: 0 },
        { x: -2, y: 2 },
        { x: -1.8, y: 2.6 },
        { x: -1.4, y: 3 },
        { x: -1, y: 3.2 },
        { x: 0, y: 3.4 },
        { x: 1, y: 3.2 },
        { x: 1.4, y: 3 },
        { x: 1.8, y: 2.6 },
        { x: 2, y: 2 },
        { x: 2, y: 0 },
        { x: 1.5, y: 0 },
        { x: 1.5, y: 2 },
        { x: 1.2, y: 2.4 },
        { x: 0.8, y: 2.6 },
        { x: 0, y: 2.8 },
        { x: -0.8, y: 2.6 },
        { x: -1.2, y: 2.4 },
        { x: -1.5, y: 2 },
        { x: -1.5, y: 0 },
      ],
      depth: 0.5,
    },
  },
  {
    id: 'stairs',
    name: 'Escalier',
    category: 'architectural',
    type: 'stairs' as Shape3DType,
    icon: '🪜',
  },
  {
    id: 'wall',
    name: 'Mur',
    category: 'architectural',
    type: 'cube',
    icon: '🧱',
    defaultScale: { width: 200, height: 100, depth: 10 },
  },
  {
    id: 'roof',
    name: 'Toit',
    category: 'architectural',
    type: 'roof' as Shape3DType,
    icon: '🏠',
    customGeometry: {
      points: [
        { x: -2, y: 0 },
        { x: 0, y: 1.5 },
        { x: 2, y: 0 },
      ],
      depth: 2,
    },
  },
  {
    id: 'window',
    name: 'Fenêtre',
    category: 'architectural',
    type: 'window' as Shape3DType,
    icon: '🪟',
    customGeometry: {
      points: [
        { x: -1, y: -1.5 },
        { x: 1, y: -1.5 },
        { x: 1, y: 1.5 },
        { x: -1, y: 1.5 },
        { x: -1, y: -1.5 },
        { x: -0.8, y: -1.3 },
        { x: -0.8, y: 1.3 },
        { x: 0.8, y: 1.3 },
        { x: 0.8, y: -1.3 },
        { x: -0.8, y: -1.3 },
      ],
      depth: 0.1,
    },
  },
  {
    id: 'door',
    name: 'Porte',
    category: 'architectural',
    type: 'door' as Shape3DType,
    icon: '🚪',
    customGeometry: {
      points: [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 2.5 },
        { x: -1, y: 2.5 },
      ],
      depth: 0.1,
    },
  },
  {
    id: 'pillar',
    name: 'Pilier',
    category: 'architectural',
    type: 'cube',
    icon: '🏗️',
    defaultScale: { width: 30, height: 200, depth: 30 },
  },
  {
    id: 'floor',
    name: 'Sol',
    category: 'architectural',
    type: 'cube',
    icon: '⬜',
    defaultScale: { width: 300, height: 5, depth: 300 },
  },

  // ============ SYMBOLS/ICONS 3D ============
  {
    id: 'star',
    name: 'Étoile',
    category: 'symbols',
    type: 'star' as Shape3DType,
    icon: '⭐',
    customGeometry: {
      points: [
        { x: 0, y: 1 },
        { x: 0.22, y: 0.31 },
        { x: 0.95, y: 0.31 },
        { x: 0.36, y: -0.12 },
        { x: 0.59, y: -0.81 },
        { x: 0, y: -0.38 },
        { x: -0.59, y: -0.81 },
        { x: -0.36, y: -0.12 },
        { x: -0.95, y: 0.31 },
        { x: -0.22, y: 0.31 },
      ],
      depth: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
    },
  },
  {
    id: 'heart',
    name: 'Cœur',
    category: 'symbols',
    type: 'heart' as Shape3DType,
    icon: '❤️',
    customGeometry: {
      points: [
        { x: 0, y: -1 },
        { x: 0.5, y: -0.5 },
        { x: 0.8, y: 0 },
        { x: 1, y: 0.4 },
        { x: 1, y: 0.7 },
        { x: 0.8, y: 1 },
        { x: 0.5, y: 1 },
        { x: 0.2, y: 0.8 },
        { x: 0, y: 0.5 },
        { x: -0.2, y: 0.8 },
        { x: -0.5, y: 1 },
        { x: -0.8, y: 1 },
        { x: -1, y: 0.7 },
        { x: -1, y: 0.4 },
        { x: -0.8, y: 0 },
        { x: -0.5, y: -0.5 },
      ],
      depth: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.05,
      bevelSize: 0.05,
    },
  },
  {
    id: 'arrow_up',
    name: 'Flèche haut',
    category: 'symbols',
    type: 'arrow' as Shape3DType,
    icon: '⬆️',
    customGeometry: {
      points: [
        { x: 0, y: 1.5 },
        { x: 0.8, y: 0.5 },
        { x: 0.3, y: 0.5 },
        { x: 0.3, y: -1.5 },
        { x: -0.3, y: -1.5 },
        { x: -0.3, y: 0.5 },
        { x: -0.8, y: 0.5 },
      ],
      depth: 0.2,
    },
  },
  {
    id: 'arrow_right',
    name: 'Flèche droite',
    category: 'symbols',
    type: 'arrow' as Shape3DType,
    icon: '➡️',
    customGeometry: {
      points: [
        { x: 1.5, y: 0 },
        { x: 0.5, y: 0.8 },
        { x: 0.5, y: 0.3 },
        { x: -1.5, y: 0.3 },
        { x: -1.5, y: -0.3 },
        { x: 0.5, y: -0.3 },
        { x: 0.5, y: -0.8 },
      ],
      depth: 0.2,
    },
  },
  {
    id: 'gear',
    name: 'Engrenage',
    category: 'symbols',
    type: 'gear' as Shape3DType,
    icon: '⚙️',
  },
  {
    id: 'plus',
    name: 'Plus',
    category: 'symbols',
    type: 'plus' as Shape3DType,
    icon: '➕',
    customGeometry: {
      points: [
        { x: -0.3, y: 1 },
        { x: 0.3, y: 1 },
        { x: 0.3, y: 0.3 },
        { x: 1, y: 0.3 },
        { x: 1, y: -0.3 },
        { x: 0.3, y: -0.3 },
        { x: 0.3, y: -1 },
        { x: -0.3, y: -1 },
        { x: -0.3, y: -0.3 },
        { x: -1, y: -0.3 },
        { x: -1, y: 0.3 },
        { x: -0.3, y: 0.3 },
      ],
      depth: 0.3,
    },
  },
  {
    id: 'cross',
    name: 'Croix',
    category: 'symbols',
    type: 'cross' as Shape3DType,
    icon: '✝️',
    customGeometry: {
      points: [
        { x: -0.2, y: 1.5 },
        { x: 0.2, y: 1.5 },
        { x: 0.2, y: 0.7 },
        { x: 0.6, y: 0.7 },
        { x: 0.6, y: 0.3 },
        { x: 0.2, y: 0.3 },
        { x: 0.2, y: -1.5 },
        { x: -0.2, y: -1.5 },
        { x: -0.2, y: 0.3 },
        { x: -0.6, y: 0.3 },
        { x: -0.6, y: 0.7 },
        { x: -0.2, y: 0.7 },
      ],
      depth: 0.2,
    },
  },
  {
    id: 'speechbubble',
    name: 'Bulle de dialogue',
    category: 'symbols',
    type: 'speechbubble' as Shape3DType,
    icon: '💬',
    customGeometry: {
      points: [
        { x: -1.5, y: 0.5 },
        { x: -1.5, y: -0.5 },
        { x: -0.5, y: -0.5 },
        { x: -0.5, y: -1 },
        { x: 0, y: -0.5 },
        { x: 1.5, y: -0.5 },
        { x: 1.5, y: 0.5 },
      ],
      depth: 0.15,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
    },
  },

  // ============ EVERYDAY OBJECTS ============
  {
    id: 'table',
    name: 'Table',
    category: 'everyday',
    type: 'table' as Shape3DType,
    icon: '🪑',
  },
  {
    id: 'chair',
    name: 'Chaise',
    category: 'everyday',
    type: 'chair' as Shape3DType,
    icon: '🪑',
  },
  {
    id: 'car',
    name: 'Voiture',
    category: 'everyday',
    type: 'car' as Shape3DType,
    icon: '🚗',
  },
  {
    id: 'tree',
    name: 'Arbre',
    category: 'everyday',
    type: 'tree' as Shape3DType,
    icon: '🌳',
  },
  {
    id: 'house',
    name: 'Maison',
    category: 'everyday',
    type: 'house' as Shape3DType,
    icon: '🏠',
  },
  {
    id: 'lamp',
    name: 'Lampe',
    category: 'everyday',
    type: 'lamp' as Shape3DType,
    icon: '💡',
  },
  {
    id: 'bottle',
    name: 'Bouteille',
    category: 'everyday',
    type: 'bottle' as Shape3DType,
    icon: '🍾',
  },
  {
    id: 'cup',
    name: 'Tasse',
    category: 'everyday',
    type: 'cup' as Shape3DType,
    icon: '☕',
  },
];

export const getShapesByCategory = (category: keyof typeof shapeCategories) => {
  return shape3DLibrary.filter(shape => shape.category === category);
};

export const getShapeById = (id: string) => {
  return shape3DLibrary.find(shape => shape.id === id);
};
