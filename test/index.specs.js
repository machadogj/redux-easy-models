import assert from 'assert';
import { createStore, applyMiddleware, combineReducers } from 'redux';
import thunkMiddleware from 'redux-thunk';
import ReduxModel, { combineModelReducers, initModels } from '../src';

describe('ReduxModel actions', () => {

  describe('single model', () => {
    // initialize a new model on every test.
    beforeEach(function initModel() {
      this.timer = {
        name: 'timer',
        initialState: { count: 0, msg: '' },
        actions: [
          'increase',
          'decrease',
          function greet() {
            return 'hi all!';
          },
          function upperGreet() {
            return this.greet().toUpperCase();
          },
          async function asyncAction() {
            await myAsyncFunc();
            return 3;
          },
          async function myOtherAsyncAction() {
            const id = await this.asyncAction();
            return id + 1;
          }
        ],
        reducers: {
          increase: (state) => Object.assign({}, state, { count: state.count + 1 }),
          decrease: (state) => Object.assign({}, state, { count: state.count - 1 }),
          greet: (state, action) => Object.assign({}, state, { msg: action.payload }),
          upperGreet: (state, action) => Object.assign({}, state, { msg: action.payload }),
          asyncAction: (state, action) => Object.assign({}, state, { count: action.payload }),
          myOtherAsyncAction: (state, action) => Object.assign({}, state, { count: action.payload })
        }
      };
      this.model = new ReduxModel(this.timer);
      const reducers = combineReducers({ [this.model.name]: this.model.reducer });
      this.store = createStore(
          reducers,
          applyMiddleware(...[thunkMiddleware])
      );
      // init right after the store is created!!
      this.model.init(this.store);
    });

    it('should allow strings', function shouldDispatchAction() {
      assert.equal(this.store.getState().timer.count, 0);
      this.model.api.increase();
      assert.equal(this.store.getState().timer.count, 1);
      this.model.api.decrease();
      assert.equal(this.store.getState().timer.count, 0);
    });

    it('should allow functions and return value', function shouldAllowStrings() {
      assert.equal(this.store.getState().timer.msg, '');
      const msg = this.model.api.greet();
      assert.equal(msg, 'hi all!');
      assert.equal(this.store.getState().timer.msg, 'hi all!');
    });

    it('should allow using other actions', function shouldAllowUsingOtherActions() {
      assert.equal(this.store.getState().timer.msg, '');
      const msg = this.model.api.upperGreet();
      assert.equal(msg, 'HI ALL!');
      assert.equal(this.store.getState().timer.msg, 'HI ALL!');
    });

    it('should allow async functions', function shouldAllowAsyncFunctions(done) {
      assert.equal(this.store.getState().timer.count, 0);
      this.model.api.asyncAction().then((result) => {
        assert.equal(result, 3);
        assert.equal(this.store.getState().timer.count, 3);
      })
      .then(done, done);
    });

    it('should allow using other async actions', function shouldAllowUsingOtherAsyncActions(done) {
      assert.equal(this.store.getState().timer.count, 0);
      this.model.api.myOtherAsyncAction().then((result) => {
        assert.equal(result, 4);
        assert.equal(this.store.getState().timer.count, 4);
      })
      .then(done, done);
    });
  });

  describe('multiple models', () => {
    beforeEach(function initModel() {
      this.timer = {
        name: 'timer',
        initialState: { count: 0 },
        actions: ['increase'],
        reducers: { increase: (state) => Object.assign({}, state, { count: state.count + 1 }) }
      };
      this.app = {
        name: 'app',
        initialState: { initialized: false },
        actions: ['init'],
        reducers: { init: (state) => Object.assign({}, state, { initialized: true }) }
      };
      this.models = {
        timer: new ReduxModel(this.timer),
        app: new ReduxModel(this.app)
      };
      const reducers = combineModelReducers(this.models);
      this.store = createStore(
          reducers,
          applyMiddleware(...[thunkMiddleware])
      );
      // init right after the store is created!!
      initModels(this.models, this.store);
    });

    it('should allow invoking from different models', function shouldAllowDifferentModels() {
      this.models.app.api.init();
      this.models.timer.api.increase();
      const { timer, app } = this.store.getState();
      assert.equal(timer.count, 1);
      assert.equal(app.initialized, true);
    });
  });
});

// helpers
function myAsyncFunc() {
  return new Promise(resolve => setTimeout(resolve, 50));
}
