/**
 * Client half of the git-sentry bundle.
 *
 * 骨架阶段：工厂只注册自身，不向任何 slot 注册内容，因此界面上看不到任何变化。
 * 这样做的目的是先让 bundle 能被安装并挂载成功，同时不把尚未定稿的界面结构
 * 写进代码——第一期 UI 的落点由后续开发按各 slot 的实际 props 决定。
 *
 * 下一步会在这里注册：
 *   - 侧边栏常驻入口（sidebar.panellist）
 *   - 主面板（main）
 *   - 右侧详情面板与设置页
 */
window.__ModuleLoader__.load({
  id: '@local/git-sentry',
  factory(require) {
    return {
      inject: ['slots'],
      apply(ctx) {
        void ctx;
      },
    };
  },
});
