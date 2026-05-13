import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '@/lib/api';
import { fmtDate, fmtTime } from '@/lib/slots';
import type { CustomerBooking } from '@/lib/types';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  HELD:      { label: 'En espera', color: '#92400e', bg: '#fef3c7' },
  CONFIRMED: { label: 'Confirmada', color: '#166534', bg: '#dcfce7' },
  COMPLETED: { label: 'Completada', color: '#374151', bg: '#f3f4f6' },
  CANCELLED: { label: 'Cancelada', color: '#6b7280', bg: '#f4f4f5' },
  NO_SHOW:   { label: 'No presentado', color: '#991b1b', bg: '#fee2e2' },
};

const SPORT_LABEL: Record<string, string> = {
  PADDLE: 'Paddle', TENNIS: 'Tenis', FOOTBALL: 'Fútbol', HOCKEY: 'Hockey',
};

export default function MisReservasScreen() {
  const [inputPhone, setInputPhone] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  const { data: bookings = [], isLoading, error, refetch } = useQuery<CustomerBooking[]>({
    queryKey: ['customer-bookings', searchPhone],
    queryFn: () => apiFetch(`/bookings/by-phone?phone=${encodeURIComponent(searchPhone)}`),
    enabled: searchPhone.length >= 6,
    staleTime: 10_000,
  });

  const search = () => {
    const cleaned = inputPhone.trim().replace(/\s/g, '');
    setSearchPhone(cleaned);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Phone search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchLabel}>Ingresá tu teléfono para ver tus reservas</Text>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={inputPhone}
              onChangeText={setInputPhone}
              placeholder="11 1234-5678"
              placeholderTextColor="#a1a1aa"
              keyboardType="phone-pad"
              onSubmitEditing={search}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={search}>
              <Text style={styles.searchBtnText}>Buscar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Results */}
        {isLoading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Error al buscar reservas.</Text>
          </View>
        ) : searchPhone && bookings.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sin reservas para ese número.</Text>
          </View>
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(b) => b.id}
            contentContainerStyle={styles.list}
            renderItem={({ item: b }) => {
              const cfg = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.CANCELLED;
              const start = new Date(b.startsAt);
              const end = new Date(b.endsAt);
              return (
                <View style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.cardCourt}>{b.court.name}</Text>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.cardSport}>
                    {SPORT_LABEL[b.court.sport] ?? b.court.sport}
                  </Text>
                  <Text style={styles.cardDate}>{fmtDate(start)}</Text>
                  <Text style={styles.cardTime}>{fmtTime(start)} – {fmtTime(end)}</Text>
                  {b.status === 'HELD' && b.heldUntil && (
                    <Text style={styles.cardExpiry}>
                      Expira: {new Date(b.heldUntil).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })}
                    </Text>
                  )}
                </View>
              );
            }}
            ListHeaderComponent={
              bookings.length > 0 ? (
                <Text style={styles.resultsCount}>{bookings.length} reserva{bookings.length !== 1 ? 's' : ''}</Text>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  searchBox: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  searchLabel: { fontSize: 13, color: '#71717a', marginBottom: 10 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1, borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#18181b', backgroundColor: '#fafafa',
  },
  searchBtn: { backgroundColor: '#3b82f6', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  list: { padding: 16, gap: 12, paddingBottom: 32 },
  resultsCount: { fontSize: 12, color: '#71717a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 3,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardCourt: { fontSize: 16, fontWeight: '700', color: '#18181b', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardSport: { fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardDate: { fontSize: 13, color: '#52525b', textTransform: 'capitalize', marginTop: 2 },
  cardTime: { fontSize: 18, fontWeight: '700', color: '#3b82f6' },
  cardExpiry: { fontSize: 11, color: '#f59e0b', marginTop: 2, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#71717a', fontSize: 14 },
});
