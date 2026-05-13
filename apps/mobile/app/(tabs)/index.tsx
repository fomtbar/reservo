import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiFetch } from '@/lib/api';
import { buildCourtSlots, fmtTime, toDateStr } from '@/lib/slots';
import type { Court, OpeningHour, TakenSlot } from '@/lib/types';

// Build array of next 21 days from today
function buildDays() {
  return Array.from({ length: 21 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });
}

const DAYS = buildDays();
const DOW_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function ReservarScreen() {
  const [selectedDate, setSelectedDate] = useState<Date>(DAYS[0]);
  const dateStr = toDateStr(selectedDate);
  const dayListRef = useRef<FlatList>(null);

  const { data: courts = [] } = useQuery<Court[]>({
    queryKey: ['courts'],
    queryFn: () => apiFetch('/courts'),
  });

  const { data: hours = [] } = useQuery<OpeningHour[]>({
    queryKey: ['opening-hours'],
    queryFn: () => apiFetch('/opening-hours'),
  });

  const { data: taken = [], isLoading } = useQuery<TakenSlot[]>({
    queryKey: ['availability', dateStr],
    queryFn: () => apiFetch(`/bookings/availability?date=${dateStr}`),
  });

  const courtSlots = useMemo(
    () => buildCourtSlots(dateStr, courts, hours, taken),
    [dateStr, courts, hours, taken],
  );

  const hasSlots = courtSlots.some((cs) => cs.slots.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Date selector */}
      <FlatList
        ref={dayListRef}
        data={DAYS}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(d) => d.toISOString()}
        contentContainerStyle={styles.datePicker}
        renderItem={({ item: day, index }) => {
          const isSelected = toDateStr(day) === dateStr;
          const isPast = day < new Date(toDateStr(new Date()) + 'T00:00:00');
          return (
            <TouchableOpacity
              style={[styles.dayItem, isSelected && styles.dayItemSelected, isPast && styles.dayItemPast]}
              onPress={() => !isPast && setSelectedDate(day)}
              disabled={isPast}
            >
              <Text style={[styles.dayDow, isSelected && styles.dayTextSelected, isPast && styles.dayTextPast]}>
                {DOW_SHORT[day.getDay()]}
              </Text>
              <Text style={[styles.dayNum, isSelected && styles.dayTextSelected, isPast && styles.dayTextPast]}>
                {day.getDate()}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {isLoading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
        ) : !hasSlots ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Sin turnos disponibles para este día.</Text>
          </View>
        ) : (
          courtSlots.map(({ court, slots }) =>
            slots.length === 0 ? null : (
              <View key={court.id} style={styles.courtSection}>
                <View style={styles.courtHeader}>
                  <View style={[styles.courtDot, { backgroundColor: court.color ?? '#3b82f6' }]} />
                  <Text style={styles.courtName}>{court.name}</Text>
                  <Text style={styles.courtSport}>{court.sport}</Text>
                </View>
                <View style={styles.slotGrid}>
                  {slots.map((slot) => (
                    <Pressable
                      key={slot.startsAt.toISOString()}
                      style={[
                        styles.slot,
                        slot.available ? styles.slotAvailable : styles.slotTaken,
                      ]}
                      onPress={() => {
                        if (!slot.available) return;
                        router.push({
                          pathname: '/confirmar',
                          params: {
                            courtId: slot.courtId,
                            courtName: slot.courtName,
                            courtColor: slot.courtColor,
                            startsAt: slot.startsAt.toISOString(),
                            endsAt: slot.endsAt.toISOString(),
                          },
                        });
                      }}
                      disabled={!slot.available}
                    >
                      <Text style={[styles.slotTime, !slot.available && styles.slotTimeTaken]}>
                        {fmtTime(slot.startsAt)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ),
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  datePicker: { paddingHorizontal: 12, paddingVertical: 8, gap: 6 },
  dayItem: {
    width: 48, paddingVertical: 8, borderRadius: 10,
    alignItems: 'center', backgroundColor: '#f4f4f5', marginRight: 6,
  },
  dayItemSelected: { backgroundColor: '#3b82f6' },
  dayItemPast: { opacity: 0.35 },
  dayDow: { fontSize: 10, fontWeight: '600', color: '#71717a', textTransform: 'uppercase' },
  dayNum: { fontSize: 18, fontWeight: '700', color: '#18181b', marginTop: 2 },
  dayTextSelected: { color: '#ffffff' },
  dayTextPast: { color: '#a1a1aa' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 20, paddingBottom: 32 },
  courtSection: { backgroundColor: '#ffffff', borderRadius: 12, padding: 14, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  courtHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  courtDot: { width: 10, height: 10, borderRadius: 5 },
  courtName: { fontSize: 15, fontWeight: '700', color: '#18181b', flex: 1 },
  courtSport: { fontSize: 11, color: '#71717a', textTransform: 'uppercase', letterSpacing: 0.5 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, minWidth: 70, alignItems: 'center' },
  slotAvailable: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  slotTaken: { backgroundColor: '#f4f4f5' },
  slotTime: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  slotTimeTaken: { color: '#a1a1aa', textDecorationLine: 'line-through' },
  empty: { flex: 1, alignItems: 'center', paddingTop: 60 },
  emptyText: { color: '#71717a', fontSize: 14 },
});
