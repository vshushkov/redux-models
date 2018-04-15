import expect from 'expect';
import configureMockStore from 'redux-mock-store';
import sinon from 'sinon';
import thunk from 'redux-thunk';
import { createModels } from '../src';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('Model group', () => {

  it('create a model group', () => {

    sinon.stub(Date, 'now').callsFake(() => 1);

    const model1spec = {
      name: 'model1',
      methods: {
        method: ({ value }) => {
          return { result: value };
        }
      }
    };

    const model2spec = {
      name: 'model2',
      methods: {
        method: ({ value }) => {
          return { result: value };
        }
      }
    };

    const { models: { model1, model2 }, reducer } = createModels({
      stateToModel: (state) => state,
      models: [model1spec, model2spec]
    });

    const store = mockStore();
    const actions = store.getActions();

    store.dispatch(model1.method({ value: 'sample1' }));
    store.dispatch(model2.method({ value: 'sample2' }));

    expect(actions).toEqual([
      { payload: [{ value: 'sample1' }], type: '@@redux-models/MODEL_1/METHOD_START' },
      { payload: [{ value: 'sample1' }], type: '@@redux-models/MODEL_1/METHOD_SUCCESS', meta: { result: 'sample1' } },
      { payload: [{ value: 'sample2' }], type: '@@redux-models/MODEL_2/METHOD_START' },
      { payload: [{ value: 'sample2' }], type: '@@redux-models/MODEL_2/METHOD_SUCCESS', meta: { result: 'sample2' } }
    ]);

    let state = {};
    actions.forEach(action => state = reducer(state, action));

    expect(state).toEqual({
      model1: {
        method: [{
          error: null,
          params: [{ value: 'sample1' }],
          requested: true,
          requesting: false,
          result: { result: 'sample1' },
          updatedAt: 1
        }]
      },
      model2: {
        method: [{
          error: null,
          params: [{ value: 'sample2' }],
          requested: true,
          requesting: false,
          result: { result: 'sample2' },
          updatedAt: 1
        }]
      }
    });

    Date.now.restore();
  });

});