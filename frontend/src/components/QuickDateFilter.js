import React from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

/**
 * QuickDateFilter Component
 * Reusable date filter with quick buttons and manual date selection
 * 
 * Props:
 * - startDate: string - Start date value
 * - endDate: string - End date value  
 * - onStartDateChange: function - Callback when start date changes
 * - onEndDateChange: function - Callback when end date changes
 * - onSearch: function - Callback when search button is clicked
 * - selectedFilter: string - Currently selected quick filter
 * - onQuickFilterChange: function - Callback when quick filter button is clicked
 * - showSearchButton: boolean - Whether to show the search button (default: true)
 * - additionalFilters: React.Node - Additional filter inputs to show alongside dates
 */
const QuickDateFilter = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSearch,
  selectedFilter = 'all',
  onQuickFilterChange,
  showSearchButton = true,
  additionalFilters = null
}) => {
  
  const handleQuickFilter = (filterType) => {
    const today = new Date();
    let start = '';
    let end = today.toISOString().split('T')[0];
    
    switch(filterType) {
      case 'today':
        start = today.toISOString().split('T')[0];
        break;
      case 'last7':
        const last7 = new Date();
        last7.setDate(today.getDate() - 7);
        start = last7.toISOString().split('T')[0];
        break;
      case 'last30':
        const last30 = new Date();
        last30.setDate(today.getDate() - 30);
        start = last30.toISOString().split('T')[0];
        break;
      case 'thisMonth':
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        start = firstDay.toISOString().split('T')[0];
        break;
      case 'all':
      default:
        start = '';
        end = '';
        break;
    }
    
    if (onStartDateChange) onStartDateChange(start);
    if (onEndDateChange) onEndDateChange(end);
    if (onQuickFilterChange) onQuickFilterChange(filterType);
    
    // Auto-search after quick filter selection
    if (onSearch) {
      setTimeout(() => onSearch(), 100);
    }
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg space-y-4">
      {/* Quick Date Filters */}
      <div className="space-y-2">
        <Label className="text-sm font-semibold">فلترة سريعة حسب التاريخ:</Label>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedFilter === 'today' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter('today')}
            className="text-sm"
          >
            📅 اليوم
          </Button>
          <Button
            variant={selectedFilter === 'last7' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter('last7')}
            className="text-sm"
          >
            📅 آخر 7 أيام
          </Button>
          <Button
            variant={selectedFilter === 'last30' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter('last30')}
            className="text-sm"
          >
            📅 آخر 30 يوم
          </Button>
          <Button
            variant={selectedFilter === 'thisMonth' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter('thisMonth')}
            className="text-sm"
          >
            📅 هذا الشهر
          </Button>
          <Button
            variant={selectedFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleQuickFilter('all')}
            className="text-sm"
          >
            📋 كل السجلات
          </Button>
        </div>
      </div>
      
      {/* Manual Date Selection */}
      <div className="border-t pt-3">
        <Label className="text-sm font-semibold mb-2 block">أو اختر تاريخ محدد:</Label>
        <div className={`grid grid-cols-1 ${additionalFilters ? 'md:grid-cols-4' : showSearchButton ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3 items-end`}>
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">من تاريخ</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                if (onStartDateChange) onStartDateChange(e.target.value);
                if (onQuickFilterChange) onQuickFilterChange('custom');
              }}
              className="h-9"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-xs text-gray-600">إلى تاريخ</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                if (onEndDateChange) onEndDateChange(e.target.value);
                if (onQuickFilterChange) onQuickFilterChange('custom');
              }}
              className="h-9"
            />
          </div>
          
          {/* Additional filters slot */}
          {additionalFilters && additionalFilters}
          
          {/* Search Button */}
          {showSearchButton && (
            <div>
              <Button 
                onClick={onSearch} 
                className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                🔍 بحث
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickDateFilter;
