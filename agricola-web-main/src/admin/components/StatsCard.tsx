interface StatCardProps {
    label: string;
    value: string | number;
    badge?: string;
    valueColor?: string;
  }
  
  export default function StatCard({ label, value, badge, valueColor }: StatCardProps) {
    return (
      <div className="bg-white rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-600">{label}</p>
          {badge && (
            <span className="text-xs px-2 py-1 bg-white border border-gray-300 rounded-full text-gray-700">
              {badge}
            </span>
          )}
        </div>
        <p className={`text-3xl font-bold ${valueColor || 'text-gray-900'}`}>
          {value}
        </p>
      </div>
    );
  }
  