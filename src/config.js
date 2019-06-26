const districtCourtsParseConfig = {
  orderNumberCol: 0,
  caseNumberCol: 1,
  timeCol: 2,
  eventCol: 3,
  roomCol: 4,
  infoCol: 5,
  judgeCol: 6,
  selector: 'div#resultTable table tbody tr',
};

const reginalCourtParseConfig = {
  orderNumberCol: 0,
  caseNumberCol: 1,
  timeCol: 2,
  roomCol: 3,
  infoCol: 4,
  judgeCol: 5,
  selector: 'div#tablcont table tbody tr',
};

const regExp = /КоАП: ст. 20.2/g;

const useProxy = false;

module.exports = {
  useProxy,
  regExp,
  districtCourtsParseConfig,
  reginalCourtParseConfig,
};
