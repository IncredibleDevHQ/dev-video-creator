# DB Setup

Planetscale DB does not support 2 imortant things we find in regular DBs:

- foreign keys ( hence we need to explicitly define indexes on foreign key column to avoid full table scans )
- functions/procedures ( we will need to move sql function logic such as `generate_link` used for slug generation to application logic).

## Note while using prisma client

Always mention select parameters in query, otherwise it will return all columns.

- It's important to always explicitly say which fields you want to return in order to not leak extra information
- @see https://github.com/prisma/prisma/issues/9353