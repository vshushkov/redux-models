import expect from 'expect';
import configureMockStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { createModel, createModels } from '../src';

const mixin = {
  name: 'mixin',
  createMethods: (model) => ({
    methodFromMixin({ value }) {
      return { mixinResult: value };
    },
    methodToOverride({ value }) {
      return { mixinResult: value };
    }
  })
};

const mixinWithReducer = {
  name: 'mixin-with-reducer',
  createMethods: (model) => ({
    methodFromMixin({ value }) {
      return { mixinResult: value };
    },
    methodToOverride({ value }) {
      return { mixinResult: value };
    }
  }),
  createReducer: (model, { METHOD_FROM_MIXIN }) => (state = {}, action) => {
    if (action.type === METHOD_FROM_MIXIN) {
      return { result: { ok: true } };
    }

    return state;
  }
};

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('Mixins', () => {

  it('create a model with mixin', () => {

    const model = createModel({
      stateToModel: (state) => state,
      name: 'model',
      mixins: [mixin],
      methods: {
        methodToOverride({ value }) {
          return { result: value };
        }
      }
    });

    const store = mockStore();
    const actions = store.getActions();
    const params = { value: 'bla' };

    store.dispatch(model.methodToOverride(params));
    store.dispatch(model.methodFromMixin(params));

    expect(actions).toEqual([
      { type: '@@redux-models/MODEL/METHOD_TO_OVERRIDE_START', payload: [params] },
      { type: '@@redux-models/MODEL/METHOD_TO_OVERRIDE_SUCCESS', payload: [params], meta: { result: 'bla' } },
      { type: '@@redux-models/MODEL/METHOD_FROM_MIXIN_START', payload: [params] },
      { type: '@@redux-models/MODEL/METHOD_FROM_MIXIN_SUCCESS', payload: [params], meta: { mixinResult: 'bla' } }
    ]);

    let state = {};
    actions.forEach(action => state = model.reducer(state, action));

    expect(model.selectors(state).methodToOverride(params))
      .toEqual({
        params: [params],
        result: { result: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model.selectors(state).methodFromMixin(params))
      .toEqual({
        params: [params],
        result: { mixinResult: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model.selectors(state).methodToOverrideResult(params))
      .toEqual({ result: 'bla' });

    expect(model.selectors(state).methodFromMixinResult(params))
      .toEqual({ mixinResult: 'bla' });
  });

  it('create a model group with mixin', () => {

    const models = createModels({
      stateToModel: (state) => state,
      mixins: [mixin],
      models: [
        {
          name: 'model1',
          methods: {
            methodToOverride({ value }) {
              return { result: value };
            }
          }
        },
        {
          name: 'model2',
          methods: {
            methodToOverride({ value }) {
              return { result: value };
            }
          }
        }
      ]
    });

    const { models: { model1, model2 }, reducer } = models;

    const store = mockStore();
    const actions = store.getActions();
    const params = { value: 'bla' };

    store.dispatch(model1.methodToOverride(params));
    store.dispatch(model2.methodToOverride(params));
    store.dispatch(model1.methodFromMixin(params));
    store.dispatch(model2.methodFromMixin(params));

    expect(actions).toEqual([
      { payload: [params], type: '@@redux-models/MODEL_1/METHOD_TO_OVERRIDE_START' },
      { payload: [params], type: '@@redux-models/MODEL_1/METHOD_TO_OVERRIDE_SUCCESS', meta: { result: 'bla' } },
      { payload: [params], type: '@@redux-models/MODEL_2/METHOD_TO_OVERRIDE_START' },
      { payload: [params], type: '@@redux-models/MODEL_2/METHOD_TO_OVERRIDE_SUCCESS', meta: { result: 'bla' } },
      { payload: [params], type: '@@redux-models/MODEL_1/METHOD_FROM_MIXIN_START' },
      { payload: [params], type: '@@redux-models/MODEL_1/METHOD_FROM_MIXIN_SUCCESS', meta: { mixinResult: 'bla' } },
      { payload: [params], type: '@@redux-models/MODEL_2/METHOD_FROM_MIXIN_START' },
      { payload: [params], type: '@@redux-models/MODEL_2/METHOD_FROM_MIXIN_SUCCESS', meta: { mixinResult: 'bla' } }
    ]);

    let state = {};
    actions.forEach(action => state = reducer(state, action));

    expect(model1.selectors(state).methodToOverride(params))
      .toEqual({
        params: [params],
        result: { result: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model1.selectors(state).methodFromMixin(params))
      .toEqual({
        params: [params],
        result: { mixinResult: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model1.selectors(state).methodToOverrideResult(params))
      .toEqual({ result: 'bla' });

    expect(model1.selectors(state).methodFromMixinResult(params))
      .toEqual({ mixinResult: 'bla' });

    expect(model2.selectors(state).methodToOverride(params))
      .toEqual({
        params: [params],
        result: { result: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model2.selectors(state).methodFromMixin(params))
      .toEqual({
        params: [params],
        result: { mixinResult: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model2.selectors(state).methodToOverrideResult(params))
      .toEqual({ result: 'bla' });

    expect(model2.selectors(state).methodFromMixinResult(params))
      .toEqual({ mixinResult: 'bla' });

  });

  it('create a model with mixin (with reducer)', () => {

    const model = createModel({
      stateToModel: (state) => state,
      name: 'model',
      mixins: [mixinWithReducer],
      methods: {
        methodToOverride({ value }) {
          return { result: value };
        }
      }
    });

    const store = mockStore();
    const actions = store.getActions();
    const params = { value: 'bla' };

    store.dispatch(model.methodToOverride(params));
    store.dispatch(model.methodFromMixin(params));

    expect(actions).toEqual([
      { type: '@@redux-models/MODEL/METHOD_TO_OVERRIDE_START', payload: [params] },
      { type: '@@redux-models/MODEL/METHOD_TO_OVERRIDE_SUCCESS', payload: [params], meta: { result: 'bla' } },
      { type: '@@redux-models/MODEL/METHOD_FROM_MIXIN_START', payload: [params] },
      { type: '@@redux-models/MODEL/METHOD_FROM_MIXIN_SUCCESS', payload: [params], meta: { mixinResult: 'bla' } }
    ]);

    let state = {};
    actions.forEach(action => state = model.reducer(state, action));

    expect(model.selectors(state).methodToOverride(params))
      .toEqual({
        params: [params],
        result: { result: 'bla' },
        requesting: false,
        requested: true,
        error: null
      });

    expect(model.selectors(state).methodFromMixin(params))
      .toEqual({ result: { ok: true } });

    expect(model.selectors(state).methodToOverrideResult(params))
      .toEqual({ result: 'bla' });

    expect(model.selectors(state).methodFromMixinResult(params))
      .toEqual({ ok: true });
  });

});