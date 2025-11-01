import React from 'react';

/**
 * AccountingReport Component
 * Printable template for accounting reports (Ledger, Journal, Commissions, etc.)
 */
const AccountingReport = ({ 
  title, 
  subtitle,
  dateRange,
  summary = [],
  data = [],
  columns = [],
  type = 'table' // 'table' or 'ledger' or 'journal'
}) => {
  
  const formatCurrency = (amount, currency = 'IQD') => {
    if (amount === null || amount === undefined) return '-';
    return `${amount.toLocaleString()} ${currency}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ar-IQ', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      padding: '40px',
      backgroundColor: '#ffffff'
    }}>
      {/* Header */}
      <div style={{ 
        textAlign: 'center', 
        borderBottom: '3px solid #2563eb',
        paddingBottom: '20px',
        marginBottom: '30px'
      }}>
        <h1 style={{ 
          fontSize: '28px', 
          margin: '0 0 10px 0',
          color: '#1e40af'
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ 
            fontSize: '16px', 
            color: '#64748b',
            margin: '5px 0'
          }}>
            {subtitle}
          </p>
        )}
        {dateRange && (
          <p style={{ 
            fontSize: '14px', 
            color: '#64748b',
            margin: '10px 0 0 0',
            fontWeight: 'bold'
          }}>
            📅 الفترة: {dateRange}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div style={{ 
          marginBottom: '30px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px'
        }}>
          {summary.map((item, idx) => (
            <div key={idx} style={{
              backgroundColor: item.color || '#f3f4f6',
              padding: '15px',
              borderRadius: '8px',
              border: '2px solid ' + (item.borderColor || '#e5e7eb')
            }}>
              <p style={{ 
                fontSize: '12px',
                margin: '0 0 5px 0',
                color: '#64748b'
              }}>
                {item.label}
              </p>
              <p style={{ 
                fontSize: '20px',
                fontWeight: 'bold',
                margin: 0,
                color: item.textColor || '#1e40af'
              }}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Data Table */}
      {data.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '12px',
            border: '1px solid #e5e7eb'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ 
                    padding: '10px',
                    border: '1px solid #e5e7eb',
                    fontWeight: 'bold',
                    textAlign: col.align || 'right',
                    color: '#1e40af'
                  }}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIdx) => (
                <tr key={rowIdx} style={{ 
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb'
                }}>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} style={{ 
                      padding: '10px',
                      border: '1px solid #e5e7eb',
                      textAlign: col.align || 'right',
                      fontWeight: col.bold ? 'bold' : 'normal',
                      color: col.color ? col.color(row[col.field]) : '#1e293b'
                    }}>
                      {col.render ? col.render(row[col.field], row) : row[col.field]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No Data Message */}
      {data.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          color: '#64748b'
        }}>
          <p style={{ fontSize: '18px', margin: 0 }}>
            لا توجد بيانات للعرض
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '50px',
        paddingTop: '20px',
        borderTop: '2px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <p style={{ 
          fontSize: '12px',
          color: '#64748b',
          margin: '0 0 10px 0'
        }}>
          تاريخ الطباعة: {new Date().toLocaleString('ar-IQ')}
        </p>
        <p style={{ 
          fontSize: '11px',
          color: '#94a3b8',
          margin: 0
        }}>
          نظام إدارة الحوالات المالية © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default AccountingReport;
