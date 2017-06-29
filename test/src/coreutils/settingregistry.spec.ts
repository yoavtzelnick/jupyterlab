// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import expect = require('expect.js');

import {
  IDataConnector, ISettingRegistry, SettingRegistry, Settings, StateDB
} from '@jupyterlab/coreutils';

import {
  JSONObject
} from '@phosphor/coreutils';


export
class TestConnector extends StateDB implements IDataConnector<ISettingRegistry.IPlugin, JSONObject> {
  constructor(public schemas: { [key: string]: ISettingRegistry.ISchema } = { }) {
    super({ namespace: 'setting-registry-tests' });
  }

  fetch(id: string): Promise<ISettingRegistry.IPlugin | null> {
    return super.fetch(id).then(user => {
      if (!user && !this.schemas[id]) {
        return null;
      }

      user = user || { };

      const schema = this.schemas[id] || { type: 'object' };
      const result = { data: { composite: { }, user }, id, schema };

      return result;
    });
  }
}


describe('@jupyterlab/coreutils', () => {

  describe('SettingRegistry', () => {

    const connector = new TestConnector();
    let registry: SettingRegistry;

    beforeEach(() => {
      return connector.clear().then(() => {
        connector.schemas = { };
        registry = new SettingRegistry({ connector });
      });
    });

    describe('#constructor()', () => {

      it('should create a new setting registry', () => {
        expect(registry).to.be.a(SettingRegistry);
      });

    });

    describe('#pluginChanged', () => {

      it('should emit when a plugin changes', done => {
        const id = 'foo';
        const key = 'bar';
        const value = 'baz';

        connector.schemas[id] = { type: 'object' };
        registry.pluginChanged.connect((sender: any, plugin: string) => {
          expect(id).to.be(plugin);
          done();
        });
        registry.load(id).then(() => registry.set(id, key, value)).catch(done);
      });

    });

    describe('#plugins', () => {

      it('should return a list of registered plugins in registry', done => {
        const one = 'foo';
        const two = 'bar';

        expect(registry.plugins).to.be.empty();
        connector.schemas[one] = { type: 'object' };
        connector.schemas[two] = { type: 'object' };
        registry.load(one)
          .then(() => { expect(registry.plugins).to.have.length(1); })
          .then(() => registry.load(two))
          .then(() => { expect(registry.plugins).to.have.length(2); })
          .then(done)
          .catch(done);
      });

    });

    describe('#get()', () => {

      it('should get a setting item from a loaded plugin', done => {
        const id = 'foo';
        const key = 'bar';
        const value = 'baz';

        connector.schemas[id] = { type: 'object' };
        connector.save(id, { [key]: value })
          .then(() => registry.load(id))
          .then(() => registry.get(id, key))
          .then(saved => { expect(saved.user).to.be(value); })
          .then(done)
          .catch(done);
      });

      it('should get a setting item from a plugin that is not loaded', done => {
        const id = 'alpha';
        const key = 'beta';
        const value = 'gamma';

        connector.schemas[id] = { type: 'object' };
        connector.save(id, { [key]: value })
          .then(() => registry.get(id, key))
          .then(saved => { expect(saved.composite).to.be(value); })
          .then(done)
          .catch(done);
      });

      it('should use schema default if user data not available', done => {
        const id = 'alpha';
        const key = 'beta';
        const value = 'gamma';
        const schema = connector.schemas[id] = {
          type: 'object',
          properties: {
            [key]: { type: typeof value, default: value }
          }
        };

        registry.get(id, key)
          .then(saved => {
            expect(saved.composite).to.be(schema.properties[key].default);
            expect(saved.composite).to.not.be(saved.user);
          }).then(done)
            .catch(done);
      });

      it('should let user value override schema default', done => {
        const id = 'alpha';
        const key = 'beta';
        const value = 'gamma';
        const schema = connector.schemas[id] = {
          type: 'object',
          properties: {
            [key]: { type: typeof value, default: 'delta' }
          }
        };

        connector.save(id, { [key]: value })
          .then(() => registry.get(id, key))
          .then(saved => {
            expect(saved.composite).to.be(value);
            expect(saved.user).to.be(value);
            expect(saved.composite).to.not.be(schema.properties[key].default);
            expect(saved.user).to.not.be(schema.properties[key].default);
          }).then(done)
            .catch(done);
      });

      it('should reject if a plugin does not exist', done => {
        registry.get('foo', 'bar')
          .then(saved => { done('should not resolve'); })
          .catch(reason => { done(); });
      });

      it('should resolve `undefined` if a key does not exist', done => {
        const id = 'foo';
        const key = 'bar';

        connector.schemas[id] = { type: 'object' };

        registry.get(id, key)
          .then(saved => {
            expect(saved.composite).to.be(void 0);
            expect(saved.user).to.be(void 0);
          }).then(done)
            .catch(done);
      });

    });

    describe('#load()', () => {

      it(`should resolve a registered plugin's settings`, done => {
        const id = 'foo';

        expect(registry.plugins).to.be.empty();
        connector.schemas[id] = { type: 'object' };
        registry.load(id)
          .then(settings => { expect(settings.plugin).to.be(id); })
          .then(done)
          .catch(done);
      });

      it('should reject if a plugin does not exist', done => {
        registry.load('foo')
          .then(settings => { done('should not resolve'); })
          .catch(reason => { done(); });
      });

    });

    describe('#reload()', () => {

      it(`should load a registered plugin's settings`, done => {
        const id = 'foo';

        expect(registry.plugins).to.be.empty();
        connector.schemas[id] = { type: 'object' };
        registry.reload(id)
          .then(settings => { expect(settings.plugin).to.be(id); })
          .then(done)
          .catch(done);
      });

      it(`should replace a registered plugin's settings`, done => {
        const id = 'foo';
        const first = 'Foo';
        const second = 'Bar';

        expect(registry.plugins).to.be.empty();
        connector.schemas[id] = { type: 'object', title: first};
        registry.reload(id)
          .then(settings => { expect(settings.schema.title).to.be(first); })
          .then(() => { connector.schemas[id].title = second; })
          .then(() => registry.reload(id))
          .then(settings => { expect(settings.schema.title).to.be(second); })
          .then(done)
          .catch(done);
      });

      it('should reject if a plugin does not exist', done => {
        registry.reload('foo')
          .then(settings => { done('should not resolve'); })
          .catch(reason => { done(); });
      });

    });

  });

  describe('Settings', () => {

    const connector = new TestConnector();
    let registry: SettingRegistry;
    let settings: Settings;

    beforeEach(() => {
      if (settings) {
        settings.dispose();
        settings = null;
      }

      return connector.clear().then(() => {
        connector.schemas = { };
        registry = new SettingRegistry({ connector });
      });
    });

    describe('#constructor()', () => {

      it('should create a new settings object for a plugin', () => {
        const id = 'alpha';
        const data = { composite: { }, user: { } };
        const schema = { type: 'object' };
        const plugin = { id, data, schema };

        settings = new Settings({ plugin, registry });
        expect(settings).to.be.a(Settings);
      });

    });

  });

});
