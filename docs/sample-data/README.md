# Sample dataset

Source: [Database Sample, Blood Donation Insights v5](https://databasesample.com/datasets/blood-donation-system), CC0 1.0. The supplied CSVs contain 100 synthetic inventory rows and 50 synthetic facility rows.

LifeFlow seeds one inventory record per blood group using the first matching source row. The app retains the group and quantity, uses a source-row label, and assigns dates relative to setup so the demo includes fresh and expiring stock. Hospital requests and the local expired example are separately authored demo records. The hospital CSV is supplied for reference.

For a fresh local demo, run `$env:DB_PATH='data/sample-demo.sqlite'; npm start` in PowerShell. Choose a new filename if that path already exists. For a new Supabase project, use the normal schema setup. Existing databases retain their records.
