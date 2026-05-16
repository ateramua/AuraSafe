import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BridgeAction,
  DESKTOP_BRIDGE_PROTOCOL_VERSION,
  ExtensionMessageType,
  buildBridgeCommand,
} from '../shared/bridge/protocol.js';

test('builds bridge commands with protocol version', () => {
  assert.deepEqual(
    buildBridgeCommand(BridgeAction.getVaultEntries, { requestId: 'request-1' }),
    {
      action: BridgeAction.getVaultEntries,
      protocolVersion: DESKTOP_BRIDGE_PROTOCOL_VERSION,
      requestId: 'request-1',
    }
  );
});

test('keeps bridge actions unique', () => {
  const values = Object.values(BridgeAction);
  assert.equal(new Set(values).size, values.length);
});

test('keeps extension message types namespaced and unique', () => {
  const values = Object.values(ExtensionMessageType);
  assert.equal(new Set(values).size, values.length);
  assert.equal(values.every((value) => value.startsWith('aurasafe.')), true);
});
