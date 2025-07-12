import React from 'react';

interface StatHexagonProps {
  speed?: number | null;
  durability?: number | null;
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
  durability,
  defense,
  offense,
  passing,
  shooting,
  dribbling,
}) => {
  const stats = [
    { name: 'Speed', value: speed },
    { name: 'Durability', value: durability },
    { name: 'Defense', value: defense },
    { name: 'Offense', value: offense },
    { name: 'Passing', value: passing },
    { name: 'Shooting', value: shooting },
    { name: 'Dribbling', value: dribbling },
  ];

  // Placeholder for actual hexagon/radar chart rendering
  // For now, we'll display the stats and their grades textually.
  // TODO: Implement SVG hexagon chart or integrate a library like react-chartjs-2

  return (
    <div className="p-4 bg-input rounded-md shadow">
      <h6 className="text-lg font-semibold text-primary mb-3 text-center">Football Attributes</h6>
      {/* Placeholder for chart */}
      <div className="my-4 text-center text-muted-foreground italic">
        [Hexagon Chart Visual Placeholder]
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {stats.map(stat => (
          <div key={stat.name} className="flex justify-between items-center">
            <span className="text-sm font-medium text-card-foreground">{stat.name}:</span>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
              valueToGrade(stat.value) === 'S' ? 'bg-yellow-400 text-yellow-900' :
              valueToGrade(stat.value) === 'A' ? 'bg-green-400 text-green-900' :
              valueToGrade(stat.value) === 'B' ? 'bg-blue-400 text-blue-900' :
              valueToGrade(stat.value) === 'C' ? 'bg-orange-400 text-orange-900' :
              valueToGrade(stat.value) === 'D' ? 'bg-red-400 text-red-900' :
              'bg-gray-300 text-gray-700' // N/A
            }`}>
              {valueToGrade(stat.value)}
            </span>
          </div>
        ))}
      </div>
       <p className="text-xs text-muted-foreground mt-3 text-center">Grades: S (90-100), A (80-89), B (70-79), C (60-69), D (0-59)</p>
    </div>
  );
};

export default StatHexagon;
