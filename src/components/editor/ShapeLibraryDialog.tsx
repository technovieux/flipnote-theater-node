import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { shape3DLibrary, shapeCategories, LibraryShape3D } from '@/data/shape3DLibrary';
import { cn } from '@/lib/utils';

interface ShapeLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectShape: (shape: LibraryShape3D) => void;
}

export const ShapeLibraryDialog: React.FC<ShapeLibraryDialogProps> = ({
  open,
  onOpenChange,
  onSelectShape,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<keyof typeof shapeCategories>('geometric');
  const [hoveredShape, setHoveredShape] = useState<string | null>(null);

  const filteredShapes = shape3DLibrary.filter(shape => shape.category === selectedCategory);

  const handleSelectShape = (shape: LibraryShape3D) => {
    onSelectShape(shape);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>📦</span> Bibliothèque d'objets 3D
          </DialogTitle>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as keyof typeof shapeCategories)}>
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(shapeCategories).map(([key, { name, icon }]) => (
              <TabsTrigger key={key} value={key} className="text-xs">
                <span className="mr-1">{icon}</span>
                <span className="hidden sm:inline">{name}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.keys(shapeCategories).map((category) => (
            <TabsContent key={category} value={category} className="mt-4">
              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {shape3DLibrary
                    .filter(shape => shape.category === category)
                    .map((shape) => (
                      <button
                        key={shape.id}
                        onClick={() => handleSelectShape(shape)}
                        onMouseEnter={() => setHoveredShape(shape.id)}
                        onMouseLeave={() => setHoveredShape(null)}
                        className={cn(
                          "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                          "hover:border-primary hover:bg-accent/50",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
                          hoveredShape === shape.id ? "border-primary bg-accent/30" : "border-border"
                        )}
                      >
                        <span className="text-3xl mb-2">{shape.icon}</span>
                        <span className="text-xs text-center font-medium">{shape.name}</span>
                      </button>
                    ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-between items-center pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {filteredShapes.length} objets disponibles
          </p>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
