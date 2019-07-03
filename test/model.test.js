import expect from 'expect';
import { combineReducers } from 'redux';
import configureMockStore from 'redux-mock-store';
import sinon from 'sinon';
import thunk from 'redux-thunk';
import { createModel } from '../src';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

const typePrefix = 'PREFIX';

describe('Model', () => {
  it('create a model with async method', () => {
    const responseData = ({ username, password }) => `${username}, ${password}`;

    const user = createModel({
      typePrefix,
      name: 'user',
      methods: {
        login: params => {
          const { username, password } = params;
          return Promise.resolve(responseData({ username, password }));
        }
      }
    });

    const params = [
      {
        username: 'username',
        password: 'password'
      }
    ];

    let state = {};
    const expectedActions = [
      { payload: { params }, type: `${typePrefix}/USER/LOGIN` },
      {
        payload: { params, result: responseData(...params) },
        type: `${typePrefix}/USER/LOGIN_SUCCESS`
      }
    ];

    const store = mockStore();
    const action = user.login(...params);

    expect(user.login.asyncAction).toEqual(true);
    expect(user.login.actionName).toEqual('login');
    expect(user.login.modelName).toEqual('user');
    expect(action.actionParams).toEqual(params);

    return store
      .dispatch(user.login(...params))
      .then(response => {
        expect(response).toEqual(responseData(...params));

        sinon.stub(Date, 'now').callsFake(() => 1);

        let selector = user(state).loginMeta(...params);
        expect(selector).toEqual({
          error: null,
          params: null,
          result: null,
          requesting: false,
          requested: false,
          updatedAt: null
        });

        let selectorResult = user(state).login(...params);
        expect(selectorResult).toEqual(null);

        state = user.reducer(state, expectedActions[0]);

        expect(state).toEqual({
          login: [
            {
              params,
              result: null,
              requesting: true,
              requested: false,
              error: null,
              updatedAt: 1
            }
          ]
        });

        selector = user(state).loginMeta(...params);
        expect(selector).toEqual({
          error: null,
          params,
          result: null,
          requesting: true,
          requested: false,
          updatedAt: 1
        });

        selectorResult = user(state).login(...params);
        expect(selectorResult).toEqual(null);

        state = user.reducer(state, expectedActions[1]);
        expect(state).toEqual({
          login: [
            {
              params,
              result: responseData(...params),
              requesting: false,
              requested: true,
              error: null,
              updatedAt: 1
            }
          ]
        });

        selector = user(state).loginMeta(...params);
        expect(selector).toEqual({
          error: null,
          params,
          result: responseData(...params),
          requesting: false,
          requested: true,
          updatedAt: 1
        });

        selectorResult = user(state).login(...params);
        expect(selectorResult).toEqual(responseData(...params));

        store.clearActions();

        Date.now.restore();

        return store.dispatch(user.login(...params));
      })
      .then(response => {
        const expectedActions = [
          { payload: { params }, type: `${typePrefix}/USER/LOGIN` },
          {
            payload: { params, result: responseData(...params) },
            type: `${typePrefix}/USER/LOGIN_SUCCESS`
          }
        ];

        sinon.stub(Date, 'now').callsFake(() => 1);

        expect(response).toEqual(responseData(...params));

        state = user.reducer(state, expectedActions[0]);
        expect(state).toEqual({
          login: [
            {
              params,
              result: responseData(...params),
              requesting: true,
              requested: true,
              error: null,
              updatedAt: 1
            }
          ]
        });

        expect(user(state).loginMeta(...params)).toEqual({
          params,
          result: responseData(...params),
          requesting: true,
          requested: true,
          error: null,
          updatedAt: 1
        });

        expect(user(state).login(...params)).toEqual(responseData(...params));

        state = user.reducer(state, expectedActions[1]);
        expect(state).toEqual({
          login: [
            {
              params,
              result: responseData(...params),
              requesting: false,
              requested: true,
              error: null,
              updatedAt: 1
            }
          ]
        });

        expect(user(state).loginMeta(...params)).toEqual({
          params,
          result: responseData(...params),
          requesting: false,
          requested: true,
          error: null,
          updatedAt: 1
        });

        expect(user(state).login(...params)).toEqual(responseData(...params));

        Date.now.restore();
      });
  });

  it('create a model with model reducer', () => {
    const initialState = { started: false, count: 0, timerId: null };

    const store = mockStore();

    const timer = createModel({
      name: 'timer',
      modelsState: ({ models }) => models,
      methods: [
        function start() {
          return setInterval(() => store.dispatch(this.increase()), 1);
        },

        'increase',

        function stop(timerId) {
          if (!timerId) {
            throw new Error('timerId required');
          }

          clearInterval(timerId);
        }
      ],
      reducer(state = initialState, { type, payload }, constants) {
        const { START, INCREASE, STOP } = constants;
        switch (type) {
          case START:
            return { ...state, started: true, timerId: payload.result };
          case INCREASE:
            return { ...state, count: state.count + 1 };
          case STOP:
            return { ...state, started: false, timerId: null };
        }

        return state;
      }
    });

    const {
      payload: { result: timerId }
    } = store.dispatch(timer.start());

    return new Promise(resolve => setTimeout(resolve, 6)).then(() => {
      store.dispatch(timer.stop(timerId));

      const actions = store.getActions();

      expect(actions[0]).toEqual({
        type: '@@redux-models/TIMER/START',
        payload: { result: timerId, params: [] }
      });

      expect(actions[1]).toEqual({
        type: '@@redux-models/TIMER/INCREASE',
        payload: { result: 'increase' }
      });

      expect(actions[actions.length - 1]).toEqual({
        type: '@@redux-models/TIMER/STOP',
        payload: { params: [timerId] }
      });

      let state = { models: {} };
      const reducer = combineReducers({
        models: combineReducers(timer.reducers)
      });

      actions.forEach(action => (state = reducer(state, action)));
      expect(state.models.timer.model.count).toBeGreaterThan(1);
      expect(state.models.timer.model.count).toEqual(
        actions.filter(({ type }) => type === '@@redux-models/TIMER/INCREASE')
          .length
      );
    });
  });

  it('handle error', () => {
    const responseError = new Error('wrong password');

    const user = createModel({
      name: 'user',
      methods: {
        login: ({ password }) => {
          if (password === 'fail') {
            return Promise.reject(responseError);
          }

          return Promise.resolve({ token: '12345' });
        }
      }
    });

    let state = {};
    const store = mockStore();
    sinon.stub(Date, 'now').callsFake(() => 1);

    return store
      .dispatch(user.login({ password: '123' }))
      .then(response => {
        const expectedActions = [
          {
            payload: { params: [{ password: '123' }] },
            type: '@@redux-models/USER/LOGIN'
          },
          {
            payload: {
              params: [{ password: '123' }],
              result: { token: '12345' }
            },
            type: '@@redux-models/USER/LOGIN_SUCCESS'
          }
        ];

        expect(response).toEqual({ token: '12345' });
        expect(store.getActions()).toEqual(expectedActions);

        store
          .getActions()
          .forEach(action => (state = user.reducer(state, action)));

        store.clearActions();

        return store.dispatch(user.login({ password: 'fail' }));
      })
      .then(() => {
        throw new Error('this error should not happen');
      })
      .catch(error => {
        const expectedActions = [
          {
            payload: { params: [{ password: 'fail' }] },
            type: '@@redux-models/USER/LOGIN'
          },
          {
            payload: { params: [{ password: 'fail' }], error: responseError },
            type: '@@redux-models/USER/LOGIN_ERROR'
          }
        ];

        expect(error.message).toEqual(responseError.message);
        expect(store.getActions()).toEqual(expectedActions);

        let selector = user(state).loginMeta();
        expect(selector).toEqual({
          error: null,
          params: null,
          requested: false,
          requesting: false,
          result: null,
          updatedAt: null
        });

        selector = user(state).login({ password: 'fail' });

        expect(selector).toEqual(null);

        state = user.reducer(state, expectedActions[0]);

        expect(state).toEqual({
          login: [
            {
              params: [{ password: '123' }],
              requested: true,
              requesting: false,
              result: { token: '12345' },
              error: null,
              updatedAt: 1
            },
            {
              params: [{ password: 'fail' }],
              requested: false,
              requesting: true,
              result: null,
              error: null,
              updatedAt: 1
            }
          ]
        });

        selector = user(state).loginMeta({ password: '123' });
        expect(selector).toEqual({
          params: [{ password: '123' }],
          requested: true,
          requesting: false,
          result: { token: '12345' },
          error: null,
          updatedAt: 1
        });

        selector = user(state).login({ password: '123' });
        expect(selector).toEqual({ token: '12345' });

        state = user.reducer(state, expectedActions[1]);
        expect(state).toEqual({
          login: [
            {
              params: [{ password: '123' }],
              requested: true,
              requesting: false,
              result: { token: '12345' },
              error: null,
              updatedAt: 1
            },
            {
              params: [{ password: 'fail' }],
              requested: true,
              requesting: false,
              result: null,
              error: responseError,
              updatedAt: 1
            }
          ]
        });

        selector = user(state).loginMeta({ password: 'fail' });
        expect(selector).toEqual({
          params: [{ password: 'fail' }],
          requested: true,
          requesting: false,
          result: null,
          error: responseError,
          updatedAt: 1
        });

        Date.now.restore();

        selector = user(state).login({ password: 'fail' });
        expect(selector).toEqual(null);
      });
  });

  it('tests reset method', () => {
    const responseError = new Error('wrong password');

    const user = createModel({
      name: 'user',
      methods: {
        login: ({ password }) => {
          if (password === 'fail') {
            return Promise.reject(responseError);
          }

          return Promise.resolve({ token: '12345' });
        },
        syncLogin: () => {
          return { token: '12345' };
        }
      }
    });

    let state = {};
    const store = mockStore();
    sinon.stub(Date, 'now').callsFake(() => 1);

    store.dispatch(user.syncLogin({ password: '123' }));
    store.dispatch(user.syncLoginReset());

    const expectedActions = store.getActions();

    state = user.reducer(state, expectedActions[0]);

    expect(state).toEqual({
      login: [],
      syncLogin: [
        {
          params: [{ password: '123' }],
          requested: true,
          requesting: false,
          result: { token: '12345' },
          error: null,
          updatedAt: 1
        }
      ]
    });

    state = user.reducer(state, expectedActions[1]);

    expect(state).toEqual({
      login: [],
      syncLogin: []
    });

    store.clearActions();

    return store.dispatch(user.login({ password: '456' })).then(() => {
      store.dispatch(user.loginReset());

      const expectedActions = store.getActions();

      state = user.reducer(state, expectedActions[0]);
      state = user.reducer(state, expectedActions[1]);

      expect(state).toEqual({
        syncLogin: [],
        login: [
          {
            params: [{ password: '456' }],
            requested: true,
            requesting: false,
            result: { token: '12345' },
            error: null,
            updatedAt: 1
          }
        ]
      });

      state = user.reducer(state, expectedActions[2]);

      expect(state).toEqual({
        login: [],
        syncLogin: []
      });

      store.clearActions();
      Date.now.restore();
    });
  });
});
