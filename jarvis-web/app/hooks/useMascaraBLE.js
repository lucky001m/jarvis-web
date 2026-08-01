'use client';

import { useState, useRef, useCallback } from 'react';

const SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

export function useMascaraBLE() {
  const [conectado, setConectado] = useState(false);
  const [conectando, setConectando] = useState(false);
  const characteristicRef = useRef(null);

  // Solo se puede llamar desde un clic real del usuario (botón),
  // el navegador lo exige por seguridad — no se puede disparar por voz.
  const conectar = useCallback(async () => {
    if (!navigator.bluetooth) {
      alert('Este navegador no soporta Web Bluetooth (usa Chrome o Edge)');
      return false;
    }

    setConectando(true);
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);

      characteristicRef.current = characteristic;
      setConectado(true);

      device.addEventListener('gattserverdisconnected', () => {
        setConectado(false);
        characteristicRef.current = null;
      });

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
    if (!characteristicRef.current) {
      console.log('Máscara no conectada, no se puede enviar:', texto);
      return false;
    }
    try {
      const data = new TextEncoder().encode(texto);
      await characteristicRef.current.writeValueWithoutResponse(data);
      return true;
    } catch (err) {
      console.log('Error enviando comando a la máscara:', err);
      return false;
    }
  }, []);

  return { conectado, conectando, conectar, enviarComando };
}
