export interface Doctor {
  id: string
  username: string
  full_name: string
}

export interface Patient {
  id: string
  doctor_id: string | null
  first_name: string
  last_name: string
  date_of_birth: string | null
  email: string | null
  phone: string | null
  diagnosis_date: string | null
  created_at: string
}

export type GlucoseContext = 'fasting' | 'pre_meal' | 'post_meal' | 'bedtime' | 'other'

export interface GlucoseReading {
  id: string
  patient_id: string
  value_mmol: number
  context: GlucoseContext
  recorded_at: string
}

export type AppointmentType = 'initial' | 'routine' | 'follow_up' | 'urgent' | 'telehealth'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export interface AppointmentData {
  id: string
  appointment_id: string
  height_cm: number | null
  weight_kg: number | null
  hba1c_percent: number | null
  blood_pressure: string | null
  overall_score: number | null
  chief_complaint: string | null
  assessment: string | null
  plan: string | null
  insulin_regimen: string | null
  follow_up_weeks: number | null
  notes: string | null
  updated_at: string
}

export interface Appointment {
  id: string
  patient_id: string
  doctor_id: string | null
  scheduled_at: string
  appointment_type: AppointmentType
  status: AppointmentStatus
  title: string | null
  description: string | null
  duration_minutes: number
  location: string | null
  notes: string | null
  cancellation_reason: string | null
  updated_at: string
  hospital_id: string | null
  appointment_data: AppointmentData | null
  patient: Pick<Patient, 'id' | 'first_name' | 'last_name'> | null
  doctor: AppointmentDoctor | null
  hospital: Hospital | null
}

export interface Hospital {
  id: string
  name: string
  city: string | null
}

export interface AppointmentDoctor {
  id: string
  full_name: string
  specialty: string | null
}

export interface Message {
  id: string
  patient_id: string
  doctor_id: string | null
  sender: 'patient' | 'doctor'
  body: string
  is_read: boolean
  created_at: string
}

export interface MessageThread {
  patient: Pick<Patient, 'id' | 'first_name' | 'last_name'>
  last_message: Message
  unread: number
}

// One message in the doctor's continuous assistant conversation (stored server-side).
export interface AssistantMessage {
  id?: string
  role: 'user' | 'assistant'
  content: string
  reasoning?: string | null
  steps?: string[]
  created_at?: string
  // Set on the reply currently being streamed.
  streaming?: boolean
}
