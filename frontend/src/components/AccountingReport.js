import React from 'react';

/**
 * AccountingReport Component
 * Printable template for accounting reports with logo and header
 */
const AccountingReport = ({ 
  title, 
  subtitle,
  dateRange,
  summary = [],
  data = [],
  columns = [],
  currentUser,
  type = 'table'
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

  const printDate = new Date().toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      padding: '25px',
      backgroundColor: '#ffffff',
      maxWidth: '210mm', // A4 width
      margin: '0 auto'
    }}>
      {/* Logo and System Name */}
      <div style={{ 
        textAlign: 'center',
        marginBottom: '15px',
        paddingBottom: '12px',
        borderBottom: '3px solid #2563eb'
      }}>
        <div style={{
          fontSize: '32px',
          fontWeight: 'bold',
          color: '#1e40af',
          marginBottom: '3px'
        }}>
          💼
        </div>
        <h1 style={{ 
          fontSize: '24px', 
          margin: '0',
          color: '#1e40af',
          fontWeight: 'bold'
        }}>
          نظام إدارة الحوالات المالية
        </h1>
      </div>

      {/* Header Info: Date and User */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px',
        backgroundColor: '#f3f4f6',
        borderRadius: '6px',
        marginBottom: '20px',
        fontSize: '13px'
      }}>
        <div>
          <strong>📅 تاريخ الطباعة:</strong> {printDate}
        </div>
        <div>
          <strong>👤 المستخدم:</strong> {currentUser?.display_name || currentUser?.username || 'النظام'}
        </div>
      </div>

      {/* Report Title */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '20px'
      }}>
        <h2 style={{ 
          fontSize: '22px', 
          margin: '0 0 8px 0',
          color: '#1e40af',
          fontWeight: 'bold'
        }}>
          {title}
        </h2>
        {subtitle && (
          <p style={{ 
            fontSize: '15px', 
            color: '#64748b',
            margin: '4px 0'
          }}>
            {subtitle}
          </p>
        )}
        {dateRange && (
          <p style={{ 
            fontSize: '14px', 
            color: '#64748b',
            margin: '8px 0 0 0',
            fontWeight: 'bold'
          }}>
            📅 الفترة: {dateRange}
          </p>
        )}
      </div>

      {/* Summary Cards */}
      {summary.length > 0 && (
        <div style={{ 
          marginBottom: '25px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px'
        }}>
          {summary.map((item, idx) => (
            <div key={idx} style={{
              backgroundColor: item.color || '#f3f4f6',
              padding: '12px',
              borderRadius: '6px',
              border: '2px solid ' + (item.borderColor || '#e5e7eb')
            }}>
              <p style={{ 
                fontSize: '11px',
                margin: '0 0 4px 0',
                color: '#64748b'
              }}>
                {item.label}
              </p>
              <p style={{ 
                fontSize: '17px',
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
        <div style={{ marginBottom: '25px' }}>
          <table style={{ 
            width: '100%', 
            borderCollapse: 'collapse',
            fontSize: '11px',
            border: '1px solid #e5e7eb'
          }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                {columns.map((col, idx) => (
                  <th key={idx} style={{ 
                    padding: '8px 6px',
                    border: '1px solid #e5e7eb',
                    fontWeight: 'bold',
                    textAlign: col.align || 'right',
                    color: '#1e40af',
                    fontSize: '11px'
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
                      padding: '7px 6px',
                      border: '1px solid #e5e7eb',
                      textAlign: col.align || 'right',
                      fontWeight: col.bold ? 'bold' : 'normal',
                      color: col.color ? col.color(row[col.field]) : '#1e293b',
                      fontSize: '11px'
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
          padding: '30px',
          backgroundColor: '#f3f4f6',
          borderRadius: '8px',
          color: '#64748b'
        }}>
          <p style={{ fontSize: '16px', margin: 0 }}>
            لا توجد بيانات للعرض
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '35px',
        paddingTop: '15px',
        borderTop: '3px solid #2563eb',
        textAlign: 'center'
      }}>
        <p style={{ 
          fontSize: '13px',
          color: '#1e40af',
          fontWeight: 'bold',
          margin: '0 0 6px 0'
        }}>
          تمت الطباعة بواسطة نظام الحوالات
        </p>
        <p style={{ 
          fontSize: '11px',
          color: '#94a3b8',
          margin: 0
        }}>
          © {new Date().getFullYear()} جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
};

export default AccountingReport;
