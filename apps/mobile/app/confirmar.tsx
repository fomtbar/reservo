import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/slots';

const SPORT_LABEL: Record<string, string> = {
  PADDLE: 'Paddle', TENNIS: 'Tenis', FOOTBALL: 'Fútbol', HOCKEY: 'Hockey',
};

export default function ConfirmarScreen() {
  const { courtId, courtName, startsAt, endsAt } = useLocalSearchParams<{
    courtId: string;
    courtName: string;
    startsAt: string;
    endsAt: string;
  }>();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState<{ id: string } | null>(null);

  const start = new Date(startsAt);
  const end = new Date(endsAt);

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert('Campos requeridos', 'Completá tu nombre y teléfono para continuar.');
      return;
    }
    setLoading(true);
    try {
      const result = await apiFetch<{ id: string }>('/bookings/hold', {
        method: 'POST',
        body: JSON.stringify({
          courtId,
          startsAt,
          endsAt,
          customer: {
            name: name.trim(),
            phone: phone.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
          },
        }),
      });
      setConfirmed(result);
    } catch (e) {
      Alert.alert('No se pudo reservar', (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (confirmed) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.successBox}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successTitle}>¡Pre-reserva enviada!</Text>
          <Text style={styles.successText}>
            El local confirmará tu turno a la brevedad.
          </Text>
          <View style={styles.successDetail}>
            <DetailRow label="Cancha">{courtName}</DetailRow>
            <DetailRow label="Fecha">{fmtDate(start)}</DetailRow>
            <DetailRow label="Horario">{fmtTime(start)} – {fmtTime(end)}</DetailRow>
            <DetailRow label="ID">{confirmed.id.slice(-8).toUpperCase()}</DetailRow>
          </View>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/')}>
            <Text style={styles.btnPrimaryText}>Volver al inicio</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Slot summary */}
          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>{courtName}</Text>
            <Text style={styles.summaryDate}>{fmtDate(start)}</Text>
            <Text style={styles.summaryTime}>{fmtTime(start)} – {fmtTime(end)}</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.formTitle}>Tus datos</Text>

            <FormField label="Nombre *" value={name} onChangeText={setName} placeholder="Juan García" />
            <FormField
              label="Teléfono *"
              value={phone}
              onChangeText={setPhone}
              placeholder="11 1234-5678"
              keyboardType="phone-pad"
            />
            <FormField
              label="Email (opcional)"
              value={email}
              onChangeText={setEmail}
              placeholder="juan@ejemplo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Confirmar reserva</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Tu reserva quedará en espera hasta que el local la confirme.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label, value, onChangeText, placeholder, keyboardType, autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#a1a1aa"
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'words'}
      />
    </View>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  summary: {
    backgroundColor: '#18181b', borderRadius: 14, padding: 20, alignItems: 'center', gap: 4,
  },
  summaryTitle: { color: '#fafafa', fontSize: 18, fontWeight: '700' },
  summaryDate: { color: '#a1a1aa', fontSize: 13, textTransform: 'capitalize' },
  summaryTime: { color: '#3b82f6', fontSize: 22, fontWeight: '800', marginTop: 4 },
  form: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  formTitle: { fontSize: 14, fontWeight: '600', color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { gap: 4 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#18181b' },
  input: {
    borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
    backgroundColor: '#fafafa', color: '#18181b',
  },
  btnPrimary: {
    backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  disclaimer: { textAlign: 'center', fontSize: 12, color: '#a1a1aa', paddingHorizontal: 20 },
  successBox: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 12 },
  successIcon: { fontSize: 64, color: '#22c55e' },
  successTitle: { fontSize: 24, fontWeight: '800', color: '#18181b' },
  successText: { fontSize: 14, color: '#71717a', textAlign: 'center' },
  successDetail: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    width: '100%', gap: 8, marginTop: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 13, color: '#71717a' },
  detailValue: { fontSize: 13, fontWeight: '600', color: '#18181b' },
});
