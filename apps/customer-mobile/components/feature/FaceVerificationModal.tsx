import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Colors, Fonts, Spacing, Radius, Shadow } from '../../constants/theme';
import { matchFace } from '../../services/faceService';

interface FaceVerificationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Phase = 'intro' | 'camera' | 'matching' | 'verified' | 'denied';

/**
 * Face verification — live FRONT camera selfie only (no gallery/upload).
 * Uses existing POST /verification/face-match via matchFace().
 */
export default function FaceVerificationModal({
  visible,
  onClose,
  onSuccess,
}: FaceVerificationModalProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('intro');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (visible) {
      setPhase('intro');
      setCameraReady(false);
      setCapturing(false);
    }
  }, [visible]);

  async function startCamera() {
    try {
      const current = permission?.granted
        ? permission
        : await requestPermission();
      if (!current?.granted) {
        setPhase('denied');
        Alert.alert(
          'Camera Permission Required',
          'LoanEx needs camera access to capture a live selfie for face verification. Gallery photos are not allowed.',
        );
        return;
      }
      setCameraReady(false);
      setPhase('camera');
    } catch {
      setPhase('denied');
      Alert.alert(
        'Camera Unavailable',
        'Unable to open the camera. Please check permissions and try again.',
      );
    }
  }

  async function captureAndVerify() {
    if (!cameraRef.current || !cameraReady || capturing || phase === 'matching') {
      return;
    }

    try {
      setCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.5,
        skipProcessing: false,
        shutterSound: false,
      });

      const base64 = photo?.base64;
      if (!base64) {
        Alert.alert(
          'Capture Failed',
          'No selfie was captured. Please position your face and try again.',
        );
        setCapturing(false);
        return;
      }

      setPhase('matching');
      setCapturing(false);

      const matchResult = await matchFace(base64);
      const ok =
        matchResult?.data?.match_status === true ||
        matchResult?.verified === true ||
        matchResult?.status?.code === 200;

      if (ok) {
        setPhase('verified');
        onSuccess();
      } else {
        Alert.alert(
          'Match Failed',
          'Face match could not be confirmed. Please try again in better lighting.',
        );
        setPhase('camera');
        setCameraReady(false);
      }
    } catch (e: any) {
      Alert.alert(
        'Verification Failed',
        e?.message || 'Face verification failed. Please try again.',
      );
      setPhase('camera');
      setCameraReady(false);
      setCapturing(false);
    }
  }

  function handleClose() {
    setPhase('intro');
    setCameraReady(false);
    setCapturing(false);
    onClose();
  }

  const showCamera = visible && (phase === 'camera' || phase === 'matching');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, showCamera && styles.cardCamera]}>
          {phase === 'verified' ? (
            <>
              <View style={styles.iconWrap}>
                <MaterialIcons name="check-circle" size={44} color={Colors.success} />
              </View>
              <Text style={styles.title}>Face verified</Text>
              <Text style={styles.subtitle}>
                Your live selfie matched the Aadhaar photo on your account.
              </Text>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelTxt}>Continue</Text>
              </Pressable>
            </>
          ) : phase === 'denied' ? (
            <>
              <View style={styles.iconWrap}>
                <MaterialIcons name="no-photography" size={44} color={Colors.error} />
              </View>
              <Text style={styles.title}>Camera access needed</Text>
              <Text style={styles.subtitle}>
                Face verification requires a live selfie from your front camera.
                Photo gallery upload is not allowed. Enable camera permission and try again.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={startCamera}>
                <Text style={styles.primaryBtnTxt}>Try again</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
            </>
          ) : showCamera ? (
            <>
              <Text style={styles.title}>Live selfie</Text>
              <Text style={styles.subtitle}>
                Position your face in the frame, then capture. Only a fresh camera selfie is accepted.
              </Text>
              <View style={styles.previewWrap}>
                <CameraView
                  ref={cameraRef}
                  style={styles.preview}
                  facing="front"
                  mirror={true}
                  mode="picture"
                  onCameraReady={() => setCameraReady(true)}
                />
                {phase === 'matching' && (
                  <View style={styles.matchingOverlay}>
                    <ActivityIndicator color="#fff" size="large" />
                    <Text style={styles.matchingTxt}>Matching face…</Text>
                  </View>
                )}
              </View>
              <Pressable
                style={[
                  styles.primaryBtn,
                  (!cameraReady || capturing || phase === 'matching') && styles.btnDisabled,
                ]}
                onPress={captureAndVerify}
                disabled={!cameraReady || capturing || phase === 'matching'}
              >
                {capturing || phase === 'matching' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <MaterialIcons name="camera-alt" size={22} color="#fff" />
                    <Text style={styles.primaryBtnTxt}>Capture selfie</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={styles.cancelBtn}
                onPress={handleClose}
                disabled={phase === 'matching'}
              >
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={styles.iconWrap}>
                <MaterialIcons name="face-retouching-natural" size={44} color={Colors.primary} />
              </View>
              <Text style={styles.title}>Verify it&apos;s you</Text>
              <Text style={styles.subtitle}>
                For your security, we capture a live selfie with your front camera and match it
                against the Aadhaar photo on your account. Gallery photos cannot be used.
              </Text>
              <Pressable style={styles.faceBtn} onPress={startCamera}>
                <MaterialIcons name="photo-camera" size={40} color="#fff" />
                <Text style={styles.faceBtnTxt}>Start Face Verification</Text>
                <Text style={styles.faceBtnSub}>Opens front camera</Text>
              </Pressable>
              <Pressable style={styles.cancelBtn} onPress={handleClose}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
    ...Shadow.lg as object,
  },
  cardCamera: {
    maxHeight: '92%',
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Fonts.xl,
    fontWeight: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Fonts.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
  previewWrap: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: Spacing.lg,
  },
  preview: {
    flex: 1,
  },
  matchingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  matchingTxt: {
    color: '#fff',
    fontSize: Fonts.md,
    fontWeight: Fonts.semiBold,
  },
  faceBtn: {
    width: '100%',
    height: 170,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  faceBtnTxt: { color: '#fff', fontSize: Fonts.lg, fontWeight: Fonts.bold },
  faceBtnSub: { color: 'rgba(255,255,255,0.85)', fontSize: Fonts.sm },
  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  primaryBtnTxt: { color: '#fff', fontSize: Fonts.lg, fontWeight: Fonts.bold },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: { alignItems: 'center', padding: Spacing.md, width: '100%' },
  cancelTxt: { color: Colors.textSecondary, fontSize: Fonts.md, fontWeight: Fonts.medium },
});
