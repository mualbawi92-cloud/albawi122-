import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';

/**
 * PrintDialog Component
 * Shows a dialog before printing to let user select what to print
 */
const PrintDialog = ({
  title = "طباعة",
  description = "اختر المعلومات التي تريد طباعتها",
  filters = [], // Array of filter options: { name, label, options: [{value, label}] }
  onPrint,
  buttonText = "🖨️ طباعة",
  buttonVariant = "outline",
  buttonClassName = "",
  disabled = false
}) => {
  const [open, setOpen] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState({});

  const handleFilterChange = (filterName, value) => {
    setSelectedFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint(selectedFilters);
    }
    setOpen(false);
  };

  return (
    <>
      <Button 
        variant={buttonVariant}
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={buttonClassName}
        type="button"
      >
        {buttonText}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-xl">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {filters.map((filter, idx) => (
              <div key={idx} className="space-y-2">
                <Label>{filter.label}</Label>
                {filter.type === 'select' ? (
                  <Select 
                    value={selectedFilters[filter.name] || filter.defaultValue || 'all'}
                    onValueChange={(value) => handleFilterChange(filter.name, value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.options.map((opt, optIdx) => (
                        <SelectItem key={optIdx} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : filter.type === 'date' ? (
                  <Input
                    type="date"
                    value={selectedFilters[filter.name] || ''}
                    onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                  />
                ) : (
                  <Input
                    type="text"
                    placeholder={filter.placeholder}
                    value={selectedFilters[filter.name] || ''}
                    onChange={(e) => handleFilterChange(filter.name, e.target.value)}
                  />
                )}
              </div>
            ))}

            {filters.length === 0 && (
              <p className="text-center text-gray-500 py-4">
                اضغط على "طباعة" لطباعة جميع البيانات
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              🖨️ طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PrintDialog;
