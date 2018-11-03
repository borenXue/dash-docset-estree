/**
 * 生成 estree.docset 文档脚本
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const shell = require('shelljs');
const marked = require('marked');
const Sequelize = require('sequelize');

const config = {
  css: path.join(__dirname, 'github.css'),
  documentsDir: path.join(__dirname, 'estree.docset/Contents/Resources/Documents'),
  globMdFilter: path.join(__dirname, 'estree/**/*.md'),
  plistSrc: path.join(__dirname, 'Info.plist'),
  plistDist: path.join(__dirname, 'estree.docset/Contents/Info.plist'),
  iconSrc: path.join(__dirname, 'icon.png'),
  iconDist: path.join(__dirname, 'estree.docset/icon.png'),
  sqlFile: path.join(__dirname, 'estree.docset/Contents/Resources/docSet.dsidx')
};
const mdFiles = glob.sync(config.globMdFilter).map(file => file.replace(`${__dirname}/`, ''));

// 删除已有 docset 文件
shell.rm('-rf', path.join(__dirname, 'estree.docset'));

/**
 * 1、初始化 docset 目录、复制 css 文件
 */
shell.mkdir('-p', `${config.documentsDir}/css`);
shell.cp(config.css, `${config.documentsDir}/css`);
for (let file of mdFiles) {
  file = file.replace('estree/', '');
  const md_filedir = file.substring(0, file.lastIndexOf('/'));
  // 如果该文件在 estree 子目录下, 且该目录在 docset 中不存在, 则需先创建目录
  if (md_filedir && !fs.existsSync(path.join(__dirname, md_filedir))) {
    shell.mkdir('-p', `${config.documentsDir}/${md_filedir.replace('estree/', '')}`)
  }
}

/**
 * 2、md 转 html, 并写入 docset 目录
 */
for (let file of mdFiles) {
  const md_filename = file.replace(/.*\//g, '').replace('.md', '');
  const md_data = fs.readFileSync(path.join(__dirname, file), 'utf-8');
  let html_data = marked(md_data);
  html_data = `
    <!-- single file version -->
    <!DOCTYPE html>
      <html>
        <head>
          <link href="css/github.css" rel="stylesheet" type="text/css">
          <meta charset="utf-8" />
        </head>
        <body>
          <h1> ${md_filename.replace("-", " ")} </h1>
          ${html_data}
        </body>
      </html>
  `;
  const distHtmlFile = `${config.documentsDir}/${file.replace('estree/', '').replace('.md', '.html')}`;
  fs.writeFileSync(distHtmlFile, html_data, 'utf-8');
}

/**
 * 3、生成对象 obj, 并将指定文件归类
 */
const dbobj = {
  Section: [],
  Namespace: []
};
for (let file of mdFiles) {
  file = file.replace('estree/', '');
  file = file.replace('.md', '.html');
  dbobj.Section.push({
    name: file.substring(file.lastIndexOf('/') + 1).replace('.html', ''),
    path: file
  });
}

/**
 * 4、创建 docset 必要的文件
 */
fs.createReadStream(config.plistSrc).pipe(fs.createWriteStream(config.plistDist));
fs.createReadStream(config.iconSrc).pipe(fs.createWriteStream(config.iconDist));

/**
 * 5、生成数据库文件
 */
const seq = new Sequelize('database', 'username', 'password', {
  dialect: 'sqlite',
  storage: config.sqlFile
});
const SearchIndex = seq.define('searchIndex', {
  id: {
    primaryKey: true,
    type: Sequelize.INTEGER,
    autoIncrement: true
  },
  name: {
    type: Sequelize.STRING
  },
  type: {
    type: Sequelize.STRING
  },
  path: {
    type: Sequelize.STRING
  }
}, {
  freezeTableName: true,
  timestamps: false
});
SearchIndex.sync().then(function(){
  const results$ = [];
  let lresult$ = [];
  for (key in dbobj) {
    const itemArray = dbobj[key];
    lresult$ = []
    for (const item of itemArray) {
      const si = SearchIndex.build({
        name: item.name,
        type: key,
        path: item.path
      }).save();
      lresult$.push(si);
    }
    results$.push(lresult$);
  }
  return results$;
});
