'use client';

import { useState, useRef, useCallback } from 'react';
import { BleClient, textToDataView } from '@capacitor-community/bluetooth-le';

const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export function useMascaraBLE() {
  const [conectado, setConectado] = useState(false);
  const [conectando, setConectando] = useState(false);
  const deviceIdRef = useRef(null);

  // Solo se puede llamar desde un clic real del usuario (botón): iOS/Android
  // exigen esa interacción para el diálogo de permiso/emparejamiento, igual
  // que antes exigía el navegador para Web Bluetooth — no se puede disparar
  // por voz.
  const conectar = useCallback(async () => {
    setConectando(true);
    try {
      // Idempotente: en iOS pide el permiso de Bluetooth la primera vez.
      await BleClient.initialize();

      const device = await BleClient.requestDevice({
        services: [SERVICE_UUID],
      });

      await BleClient.connect(device.deviceId, () => {
        setConectado(false);
        deviceIdRef.current = null;
      });

      deviceIdRef.current = device.deviceId;
      setConectado(true);
      return true;
    } catch (err) {
      console.log('Error conectando a la máscara:', err);
      return false;
    } finally {
      setConectando(false);
    }
  }, []);

  // Esta sí se puede llamar desde código disparado por voz, una vez conectado
  const enviarComando = useCallback(async (texto) => {
    if (!deviceIdRef.current) {
      console.log('Máscara no conectada, no se puede enviar:', texto);
      return false;
    }
    try {
      await BleClient.writeWithoutResponse(
        deviceIdRef.current,
        SERVICE_UUID,
        CHARACTERISTIC_UUID,
        textToDataView(texto)
      );
      return true;
    } catch (err) {
      console.log('Error enviando comando a la máscara:', err);
      return false;
    }
  }, []);

  return { conectado, conectando, conectar, enviarComando };
}
