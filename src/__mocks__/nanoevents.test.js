const { createNanoEvents } = require('./nanoevents');

describe('nanoevents mock', () => {
  describe('createNanoEvents', () => {
    it('should return an object with on and emit methods', () => {
      const emitter = createNanoEvents();

      expect(emitter).toBeDefined();
      expect(typeof emitter.on).toBe('function');
      expect(typeof emitter.emit).toBe('function');
    });
  });

  describe('on', () => {
    it('should return an unsubscribe function', () => {
      const emitter = createNanoEvents();
      const unsubscribe = emitter.on('testEvent', () => {});

      expect(typeof unsubscribe).toBe('function');
    });

    it('should accept an event name and callback', () => {
      const emitter = createNanoEvents();
      const callback = jest.fn();

      expect(() => {
        emitter.on('testEvent', callback);
      }).not.toThrow();
    });
  });

  describe('emit', () => {
    it('should not throw when emitting an event', () => {
      const emitter = createNanoEvents();

      expect(() => {
        emitter.emit('testEvent');
      }).not.toThrow();
    });

    it('should accept event name and additional arguments', () => {
      const emitter = createNanoEvents();

      expect(() => {
        emitter.emit('testEvent', 'arg1', 'arg2', { key: 'value' });
      }).not.toThrow();
    });
  });

  describe('multiple instances', () => {
    it('should create independent emitter instances', () => {
      const emitter1 = createNanoEvents();
      const emitter2 = createNanoEvents();

      expect(emitter1).not.toBe(emitter2);
    });
  });
});
