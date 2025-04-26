-- Add new targeting rule types
INSERT INTO targeting_rule_types (id, name, description)
VALUES 
  (5, 'os', 'Target by operating system'),
  (6, 'browser', 'Target by web browser'),
  (7, 'weekdays', 'Target by days of the week'),
  (8, 'hours', 'Target by hours of the day'),
  (9, 'unique_users', 'Limit visits per user over a specific time period'); 