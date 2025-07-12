import React from 'react';

interface StatHexagonProps {
  speed?: number | null;
  // durability?: number | null; // Removed, focusing on 6 core stats
  defense?: number | null;
  offense?: number | null;
  passing?: number | null;
  shooting?: number | null;
  dribbling?: number | null;
}

// Helper function to map numerical stat (0-100) to letter grade (S, A, B, C, D)
const valueToGrade = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 90) return 'S';
  if (value >= 80) return 'A';
  if (value >= 70) return 'B';
  if (value >= 60) return 'C';
  if (value >= 0) return 'D'; // Assuming 0-59 is D
  return 'N/A'; // Should not happen if validation is 0-100
};

const StatHexagon: React.FC<StatHexagonProps> = ({
  speed,
  // durability, // Removed from props
  defense,
  offense,
  passing,
  shooting,
  dribbling,
}) => {
  const coreStats = [ // Order for hexagon points: Top, Top-Right, Bottom-Right, Bottom, Bottom-Left, Top-Left
    { name: 'Speed', value: speed, key: 'speed' as const },
    { name: 'Offense', value: offense, key: 'offense' as const },
    { name: 'Shooting', value: shooting, key: 'shooting' as const },
    { name: 'Passing', value: passing, key: 'passing' as const },
    { name: 'Dribbling', value: dribbling, key: 'dribbling' as const },
    { name: 'Defense', value: defense, key: 'defense' as const },
  ]; // Order for hexagon points: Top, Top-Right, Bottom-Right, Bottom, Bottom-Left, Top-Left

  // Placeholder for actual hexagon/radar chart rendering
  // For now, we'll display the stats and their grades textually.
  dribbling,
}) => {
  const coreStats = [ // Order for hexagon points: Top, Top-Right, Bottom-Right, Bottom, Bottom-Left, Top-Left
    { name: 'Speed', value: speed, key: 'speed' as const },
    { name: 'Offense', value: offense, key: 'offense' as const },
    { name: 'Shooting', value: shooting, key: 'shooting' as const },
    { name: 'Passing', value: passing, key: 'passing' as const },
    { name: 'Dribbling', value: dribbling, key: 'dribbling' as const },
    { name: 'Defense', value: defense, key: 'defense' as const },
  ];

  const size = 220; // SVG canvas size
  const center = size / 2;
  const radius = size * 0.4; // Max radius for the hexagon
  const numLevels = 4; // For D, C, B, A/S rings (e.g. 25, 50, 75, 100%)
  const angleSlice = (Math.PI * 2) / 6;

  const pointsToString = (points: Array<{x: number, y: number}>) => {
    return points.map(p => `${p.x},${p.y}`).join(' ');
  };

  // Calculate points for a regular hexagon layer
  const getHexagonLayerPoints = (currentRadius: number) => {
    const points = [];
    for (let i = 0; i < 6; i++) {
      points.push({
        x: center + currentRadius * Math.cos(angleSlice * i - Math.PI / 2), // Start from top
        y: center + currentRadius * Math.sin(angleSlice * i - Math.PI / 2),
      });
    }
    return points;
  };

  // Calculate points for the player's stat polygon
  const statPolygonPoints = coreStats.map((stat, i) => {
    const statValue = stat.value ?? 0; // Treat null/undefined as 0 for plotting
    const currentRadius = (Math.max(0, Math.min(100, statValue)) / 100) * radius; // Normalize 0-100 to radius
    return {
      x: center + currentRadius * Math.cos(angleSlice * i - Math.PI / 2),
      y: center + currentRadius * Math.sin(angleSlice * i - Math.PI / 2),
    };
  });

  const axisLabels = coreStats.map((stat, i) => {
    const labelRadius = radius * 1.15; // Position labels slightly outside the main hexagon
    return {
      x: center + labelRadius * Math.cos(angleSlice * i - Math.PI / 2),
      y: center + labelRadius * Math.sin(angleSlice * i - Math.PI / 2),
      name: stat.name,
      grade: valueToGrade(stat.value),
    };
  });

  return (
    <div className="p-4 bg-input rounded-md shadow">
      <h6 className="text-lg font-semibold text-primary mb-1 text-center">Football Attributes</h6>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
        {/* Background Hexagon Layers & Axes lines */}
        {[...Array(numLevels)].map((_, levelIndex) => {
          const levelRadius = (radius / numLevels) * (levelIndex + 1);
          const points = getHexagonLayerPoints(levelRadius);
          return (
            <polygon
              key={`level-${levelIndex}`}
              points={pointsToString(points)}
              className={`fill-none ${levelIndex === numLevels -1 ? 'stroke-primary/50' : 'stroke-border/70'}`} // Outer ring stronger
              strokeWidth="1"
            />
          );
        })}
        {/* Axes lines from center to vertices */}
        {getHexagonLayerPoints(radius).map((point, i) => (
           <line
             key={`axis-line-${i}`}
             x1={center} y1={center}
             x2={point.x} y2={point.y}
             className="stroke-border/70"
             strokeWidth="1"
           />
        ))}

        {/* Player Stat Polygon */}
        <polygon
          points={pointsToString(statPolygonPoints)}
          className="fill-accent/50 stroke-accent"
          strokeWidth="2"
        />

        {/* Attribute Labels & Grades */}
        {axisLabels.map((label, i) => (
          <text
            key={`label-${i}`}
            x={label.x}
            y={label.y}
            dy={label.y < center ? -4 : (label.y === center ? 4 : 12) } // Adjust dy for better positioning
            className="text-xs fill-current text-muted-foreground"
            textAnchor="middle"
          >
            {label.name} <tspan className="font-bold">{`(${label.grade})`}</tspan>
          </text>
        ))}
      </svg>
      <p className="text-xs text-muted-foreground mt-2 text-center">Grades: S (90-100), A (80-89), B (70-79), C (60-69), D (0-59)</p>
    </div>
  );
};

export default StatHexagon;
