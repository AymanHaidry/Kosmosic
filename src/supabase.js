import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://todzlszlihqzytihejiq.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZHpsc3psaWhxenl0aWhlamlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMjY3NTAsImV4cCI6MjA5MzkwMjc1MH0.PHP6lxns3R-jrL05pce7V4NoKwSUGgEx6fy27WJ0Ack'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
