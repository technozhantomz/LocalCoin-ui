import React from "react";
import Translate from "react-translate-component";
import {saveAs} from "file-saver";
import Operation from "../../components/Blockchain/Operation";
import ChainTypes from "../../components/Utility/ChainTypes";
import BindToChainState from "../../components/Utility/BindToChainState";
import utils from "common/utils";
import {ChainTypes as grapheneChainTypes} from "bitsharesjs/es";
import TransitionWrapper from "../../components/Utility/TransitionWrapper";
import ps from "perfect-scrollbar";
import counterpart from "counterpart";
import Icon from "../../components/Icon/Icon";
import cnames from "classnames";
import PropTypes from "prop-types";
import {csvIcon} from "../../assets/brand-new-layout/img/images";
import ReactTooltip from "react-tooltip";

const {operations} = grapheneChainTypes;
const alignLeft = {textAlign: "left"};
const alignRight = {textAlign: "right"};

function compareOps(b, a) {
    if (a.block_num === b.block_num) {
        return a.virtual_op - b.virtual_op;
    } else {
        return a.block_num - b.block_num;
    }
}

function textContent(n) {
    return n ? `"${n.textContent.replace(/[\s\t\r\n]/gi, " ")}"` : "";
}

class RecentTransactions extends React.Component {
    static propTypes = {
        accountsList: ChainTypes.ChainAccountsList.isRequired,
        compactView: PropTypes.bool,
        limit: PropTypes.number,
        maxHeight: PropTypes.number,
        fullHeight: PropTypes.bool,
        showFilters: PropTypes.bool
    };

    static defaultProps = {
        limit: 25,
        maxHeight: 500,
        fullHeight: false,
        showFilters: false
    };

    constructor(props) {
        super();
        this.state = {
            limit: props.limit || 20,
            csvExport: false,
            headerHeight: 85,
            openFilter: false,
            filter: "all"
        };
        this._updateTooltip = this._updateTooltip.bind(this);
        this._downloadCSV = this._downloadCSV.bind(this);
        this._findActiveFilter = this._findActiveFilter.bind(this);
        this._renderFilters = this._renderFilters.bind(this);
    }

    componentDidMount() {
        this._updateTooltip();
        if (!this.props.fullHeight) {
            let t = this.refs.transactions;
            ps.initialize(t);

            this._setHeaderHeight();
        }
    }

    _setHeaderHeight() {
        let height = this.refs.header.offsetHeight;
        if (height !== this.state.headerHeight) {
            this.setState({
                headerHeight: height
            });
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (
            !utils.are_equal_shallow(
                this.props.accountsList,
                nextProps.accountsList
            )
        )
            return true;
        if (this.props.maxHeight !== nextProps.maxHeight) return true;
        if (this.state.headerHeight !== nextState.headerHeight) return true;
        if (this.state.openFilter !== nextState.openFilter) return true;
        if (this.state.filter !== nextState.filter) return true;
        if (this.props.customFilter) {
            if (
                !utils.are_equal_shallow(
                    this.props.customFilter.fields,
                    nextProps.customFilter.fields
                ) ||
                !utils.are_equal_shallow(
                    this.props.customFilter.values,
                    nextProps.customFilter.values
                )
            ) {
                return true;
            }
        }

        if (this.props.maxHeight !== nextProps.maxHeight) return true;
        if (
            nextState.limit !== this.state.limit ||
            nextState.csvExport !== this.state.csvExport
        )
            return true;
        for (let key = 0; key < nextProps.accountsList.length; ++key) {
            let npa = nextProps.accountsList[key];
            let nsa = this.props.accountsList[key];
            if (npa && nsa && npa.get("history") !== nsa.get("history"))
                return true;
        }
        return false;
    }

    componentDidUpdate() {
        this._updateTooltip();
        if (this.state.csvExport) {
            this.state.csvExport = false;
            const csv_export_container = document.getElementById(
                "csv_export_container"
            );
            const nodes = csv_export_container.childNodes;
            let csv = "";
            for (const n of nodes) {
                //console.log("-- RecentTransactions._downloadCSV -->", n);
                const cn = n.childNodes;
                if (csv !== "") csv += "\n";
                csv += [
                    textContent(cn[0]),
                    textContent(cn[1]),
                    textContent(cn[2]),
                    textContent(cn[3])
                ].join(",");
            }
            var blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
            var today = new Date();
            saveAs(
                blob,
                "btshist-" +
                    today.getFullYear() +
                    "-" +
                    ("0" + (today.getMonth() + 1)).slice(-2) +
                    "-" +
                    ("0" + today.getDate()).slice(-2) +
                    "-" +
                    ("0" + today.getHours()).slice(-2) +
                    ("0" + today.getMinutes()).slice(-2) +
                    ".csv"
            );
        }

        if (!this.props.fullHeight) {
            let t = this.refs.transactions;
            ps.update(t);

            this._setHeaderHeight();
        }
    }

    _onIncreaseLimit() {
        this.setState({
            limit: this.state.limit + 30
        });
    }

    _getHistory(accountsList, filterOp, customFilter) {
        let history = [];
        let seen_ops = new Set();
        for (let account of accountsList) {
            if (account) {
                let h = account.get("history");
                if (h)
                    history = history.concat(
                        h
                            .toJS()
                            .filter(
                                op =>
                                    !seen_ops.has(op.id) && seen_ops.add(op.id)
                            )
                    );
            }
        }
        if (filterOp) {
            history = history.filter(a => {
                return a.op[0] === operations[filterOp];
            });
        }

        if (customFilter) {
            history = history.filter(a => {
                let finalValue = customFilter.fields.reduce((final, filter) => {
                    switch (filter) {
                        case "asset_id":
                            return (
                                final &&
                                a.op[1]["amount"][filter] ===
                                    customFilter.values[filter]
                            );
                            break;
                        default:
                            return (
                                final &&
                                a.op[1][filter] === customFilter.values[filter]
                            );
                            break;
                    }
                }, true);
                return finalValue;
            });
        }
        return history;
    }

    _downloadCSV() {
        this.setState({csvExport: true});
    }

    _onChangeFilter(e) {
        this.setState({
            filter: e.target.value
        });
    }

    _findActiveFilter(items) {
        return items.find(title => title === this.state.filter);
    }

    _updateTooltip() {
        ReactTooltip.rebuild();
    }

    _renderFilters(items) {
        const activeFilter = this._findActiveFilter(items);
        return activeFilter ? (
            <div
                className={cnames("select", {
                    "is-open": this.state.openFilter
                })}
            >
                <span
                    className="placeholder"
                    onClick={e => {
                        e.preventDefault();
                        this.setState({
                            openFilter: !this.state.openFilter
                        });
                    }}
                >
                    {counterpart.translate(
                        `transaction.trxTypes.${activeFilter}`
                    )}
                </span>
                <ul>
                    {items
                        .filter(title => title !== activeFilter)
                        .map(title => {
                            return (
                                <li
                                    key={`${title}`}
                                    onClick={e => {
                                        e.preventDefault();
                                        this.setState({
                                            filter: title
                                        });
                                        this.setState({
                                            openFilter: false
                                        });
                                    }}
                                >
                                    {counterpart.translate(
                                        `transaction.trxTypes.${title}`
                                    )}
                                </li>
                            );
                        })}
                </ul>
            </div>
        ) : null;
    }

    render() {
        let {
            accountsList,
            compactView,
            filter,
            customFilter,
            style,
            maxHeight
        } = this.props;
        let {limit, headerHeight} = this.state;
        let current_account_id =
            accountsList.length === 1 && accountsList[0]
                ? accountsList[0].get("id")
                : null;
        let history = this._getHistory(
            accountsList,
            this.props.showFilters && this.state.filter !== "all"
                ? this.state.filter
                : filter,
            customFilter
        ).sort(compareOps);
        let historyCount = history.length;

        ReactTooltip.rebuild();
        // style = style ? style : {};
        // style.width = "100%";
        // style.height = "100%";

        let options = null;
        if (true || this.props.showFilters) {
            options = [
                "all",
                "transfer",
                "limit_order_create",
                "limit_order_cancel",
                "fill_order",
                "account_create",
                "account_update",
                "asset_create",
                "witness_withdraw_pay",
                "vesting_balance_withdraw"
            ];
        }

        let display_history = history.length
            ? history.slice(0, limit).map(o => {
                  return (
                      <Operation
                          includeOperationId={true}
                          operationId={o.id}
                          style={alignLeft}
                          key={o.id}
                          op={o.op}
                          result={o.result}
                          block={o.block_num}
                          current={current_account_id}
                          hideFee
                          inverted={false}
                          hideOpLabel={compactView}
                          fullDate={true}
                      />
                  );
              })
            : [
                  <tr key="no_recent">
                      <td colSpan={compactView ? "2" : "3"}>
                          <Translate content="operation.no_recent" />
                      </td>
                  </tr>
              ];
        if (
            (this.props.showMore && historyCount > this.props.limit) ||
            (20 && limit < historyCount)
        ) {
            display_history.push(
                <tr className="total-value" key="total_value">
                    <td className="column-hide-tiny" />
                    <td style={alignRight} />
                    <td style={{textAlign: "center"}}>
                        &nbsp;
                        <a onClick={this._onIncreaseLimit.bind(this)}>
                            <Icon
                                name="chevron-down"
                                title="icons.chevron_down.transactions"
                                className="icon-14px"
                            />
                        </a>
                    </td>
                    <td>&nbsp;</td>
                </tr>
            );
        }

        return (
            <div className="recent-transactions no-overflow" style={style}>
                <div className="generic-bordered-box">
                    {this.props.dashboard ? null : (
                        <div ref="header">
                            <div className="block-content-header">
                                <span>
                                    {this.props.title ? (
                                        this.props.title
                                    ) : (
                                        <Translate content="account.recent" />
                                    )}
                                </span>
                            </div>
                        </div>
                    )}
                    <div className="dashboard__actions">
                        <div className="container-fluid">
                            <div className="row">
                                <div className="col-lg-3">
                                    {this.props.showFilters
                                        ? this._renderFilters(options)
                                        : null}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="dashboard__adaptive">
                        <table
                            className={
                                "dashboard__table transactions-list blue-bg with-borders" +
                                (compactView ? "compact" : "") +
                                (this.props.dashboard ? " dashboard-table" : "")
                            }
                        >
                            <thead>
                                <tr>
                                    <th
                                        className="column-hide-tiny"
                                        style={alignLeft}
                                    >
                                        <Translate content="account.transactions.id" />
                                    </th>
                                    <th
                                        className="column-hide-tiny"
                                        style={alignLeft}
                                    >
                                        <Translate
                                            content="account.transactions.type"
                                            onLoad={this._updateTooltip()}
                                        />
                                    </th>
                                    <th style={alignLeft}>
                                        <Translate content="account.transactions.fee" />
                                    </th>
                                    <th style={alignLeft}>
                                        <Translate content="account.transactions.info" />
                                    </th>
                                    <th style={alignLeft}>
                                        <Translate content="account.transactions.time" />
                                    </th>
                                </tr>
                            </thead>
                            <TransitionWrapper
                                component="tbody"
                                transitionName="newrow"
                            >
                                {display_history}
                            </TransitionWrapper>
                        </table>
                    </div>
                    {historyCount > 0 ? (
                        <div className="export-row" style={{marginTop: "20px"}}>
                            <a
                                className="csv-export"
                                href="#"
                                onClick={e => {
                                    e.preventDefault();
                                    this._downloadCSV();
                                }}
                            >
                                <img src={csvIcon} alt="" />
                                {counterpart.translate("transaction.csv_tip")}
                            </a>
                        </div>
                    ) : null}
                    {historyCount > 0 &&
                        this.state.csvExport && (
                            <div
                                id="csv_export_container"
                                style={{display: "none"}}
                            >
                                <div>
                                    <div>DATE</div>
                                    <div>OPERATION</div>
                                    <div>MEMO</div>
                                    <div>AMOUNT</div>
                                </div>
                                {history.map(o => {
                                    return (
                                        <Operation
                                            key={o.id}
                                            op={o.op}
                                            result={o.result}
                                            block={o.block_num}
                                            inverted={false}
                                            csvExportMode
                                        />
                                    );
                                })}
                            </div>
                        )}
                </div>
            </div>
        );
    }
}
RecentTransactions = BindToChainState(RecentTransactions);

class TransactionWrapper extends React.Component {
    static propTypes = {
        asset: ChainTypes.ChainAsset.isRequired,
        to: ChainTypes.ChainAccount.isRequired,
        fromAccount: ChainTypes.ChainAccount.isRequired
    };

    static defaultProps = {
        asset: "1.3.0"
    };

    render() {
        return (
            <span className="wrapper">{this.props.children(this.props)}</span>
        );
    }
}
TransactionWrapper = BindToChainState(TransactionWrapper);

export {RecentTransactions, TransactionWrapper};
