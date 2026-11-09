import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from backend/.env and root .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../src/config/database';
import { DatabaseMaintenanceService, APPLICATION_DATA_TABLES, ResetOptions } from '../src/services/databaseMaintenance.service';

export { APPLICATION_DATA_TABLES };

export async function resetDatabase(options: ResetOptions = {}) {
  return DatabaseMaintenanceService.resetDatabase(options);
}

// CLI Execution entrypoint
if (require.main === module) {
  DatabaseMaintenanceService.resetDatabase()
    .catch((err) => {
      console.error('\n❌ Reset aborted:', err.message);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
