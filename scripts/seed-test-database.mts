// Fills a throwaway local database with the browser tests' sample marketplace (one customer, sellers, a rider, an admin
// and four products). Refuses a database that is not local and named for testing, because it empties the tables first.
import { seedDatabase } from '../e2e/seed.ts';

await seedDatabase(process.env.DATABASE_URL ?? '');
console.log('Seeded the test database.');
