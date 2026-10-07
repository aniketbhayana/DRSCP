
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const requestsRoutes = require('./routes/requests.routes');
const allocationsRoutes = require('./routes/allocations.routes');
const sheltersRoutes = require('./routes/shelters.routes');
const volunteersRoutes = require('./routes/volunteers.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const auditRoutes = require('./routes/audit.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/allocations', allocationsRoutes);
app.use('/api/shelters', sheltersRoutes);
app.use('/api/volunteers', volunteersRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/audit', auditRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
