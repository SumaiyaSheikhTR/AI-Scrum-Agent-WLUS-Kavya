import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

interface AdhocAssignmentVisualsProps {
  teamCapacityChart: Array<{
    name: string;
    capacity: number;
    utilized: number;
    remaining: number;
    utilizationPercent: number;
    confidence: number;
  }>;
  workloadDistribution: Array<{
    member: string;
    active: number;
    completed: number;
    total: number;
  }>;
  priorityMatrix: Array<{
    priority: string;
    type: string;
    count: number;
    totalEffort: number;
  }>;
  unassignedItems: Array<{
    id: number;
    title: string;
    priority: number | null;
    effort: number | null;
    type: string;
  }>;
  recommendedAssignees: Array<{
    member: { displayName: string };
    utilizationPercent: number;
    remainingCapacity: number;
    confidence: number;
    recommendation: string;
  }>;
  onItemSelect?: (itemId: number) => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const AdhocAssignmentVisuals: React.FC<AdhocAssignmentVisualsProps> = ({
  teamCapacityChart,
  workloadDistribution,
  priorityMatrix,
  unassignedItems,
  recommendedAssignees,
  onItemSelect
}) => {
  const [selectedItem, setSelectedItem] = useState<number | null>(null);

  const handleItemSelect = (itemId: number) => {
    setSelectedItem(itemId);
    onItemSelect?.(itemId);
  };

  return (
    <div className="space-y-6 p-4">
      {/* Team Capacity Overview */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          📊 Team Capacity Analysis
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={teamCapacityChart}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip 
              formatter={(value, name) => [
                `${value} hours`, 
                name === 'utilized' ? 'Used' : name === 'remaining' ? 'Available' : 'Total'
              ]}
              labelFormatter={(label) => `Team Member: ${label}`}
            />
            <Legend />
            <Bar dataKey="utilized" stackId="a" fill="#ff6b6b" name="Utilized" />
            <Bar dataKey="remaining" stackId="a" fill="#4ecdc4" name="Available" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Recommendations */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          🎯 Top Assignment Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recommendedAssignees.slice(0, 3).map((rec, index) => (
            <div 
              key={rec.member.displayName}
              className={`p-4 rounded-lg border-2 ${
                index === 0 ? 'border-green-500 bg-green-50' :
                index === 1 ? 'border-blue-500 bg-blue-50' :
                'border-orange-500 bg-orange-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-gray-800">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'} {rec.member.displayName}
                </h4>
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  rec.confidence > 80 ? 'bg-green-200 text-green-800' :
                  rec.confidence > 60 ? 'bg-yellow-200 text-yellow-800' :
                  'bg-red-200 text-red-800'
                }`}>
                  {rec.confidence.toFixed(0)}% confidence
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Utilization:</span>
                  <span className="font-medium">{rec.utilizationPercent.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Available:</span>
                  <span className="font-medium">{rec.remainingCapacity}h</span>
                </div>
                <p className="text-gray-600 text-xs mt-2">{rec.recommendation}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unassigned Items Selection */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">
          📋 Select Adhoc Item to Assign
        </h3>
        <div className="max-h-96 overflow-y-auto">
          <div className="space-y-2">
            {unassignedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemSelect(item.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedItem === item.id
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-blue-600">#{item.id}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        (item.priority || 0) >= 3 ? 'bg-red-100 text-red-800' :
                        (item.priority || 0) >= 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        P{item.priority || 'N/A'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                        {item.type}
                      </span>
                    </div>
                    <h4 className="font-medium text-gray-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-gray-600">
                      Estimated: {item.effort || 'Unknown'} hours
                    </p>
                  </div>
                  {selectedItem === item.id && (
                    <div className="ml-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {selectedItem && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              ✅ Selected item #{selectedItem}. The AI will now provide specific assignment recommendations based on this selection and team capacity analysis.
            </p>
          </div>
        )}
      </div>

      {/* Workload Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            📈 Current Workload Distribution
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={workloadDistribution} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="member" type="category" width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="active" fill="#ff9999" name="Active Tasks" />
              <Bar dataKey="completed" fill="#66b3ff" name="Completed" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Matrix */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            🎯 Unassigned Items by Priority
          </h3>
          {priorityMatrix.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={priorityMatrix}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ priority, count }) => `${priority}: ${count}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {priorityMatrix.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} items`, 'Count']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No unassigned items found
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdhocAssignmentVisuals;
