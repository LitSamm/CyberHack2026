const supabase = require('../db/supabase');

/**
 * Audit logging middleware — logs every mutating request to audit_logs table
 */
const auditLog = (tableName, action) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    let responseData = null;

    res.json = (data) => {
      responseData = data;
      return originalJson(data);
    };

    next();

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const recordId = req.params.id || (responseData && responseData.id) || null;
          await supabase.from('audit_logs').insert({
            user_id: req.user.id,
            action: action || req.method,
            table_name: tableName,
            record_id: recordId,
            old_value: req.auditData?.oldValue || null,
            new_value: req.auditData?.newValue || req.body || null,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Audit log error:', err.message);
        }
      }
    });
  };
};

module.exports = { auditLog };
