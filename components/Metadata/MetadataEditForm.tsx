import {
  useAddRelationMutation,
  useDeleteRelationMutation,
} from "@/services/metadata";
import {
  DBMetaDataColumn,
  DBMetaDataContainer,
  DBMetaRelationship,
} from "@/services/types";
import {
  Button,
  Flex,
  Input,
  InputRef,
  Modal,
  notification,
  Select,
  Space,
  Switch,
  Table,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import AddRelationForm, { FormValues } from "./AddRelationForm";
import { getRelationType } from "../utils/utils";
import { SearchOutlined, ShareAltOutlined } from "@ant-design/icons";
const { Text } = Typography;
import type { ColumnsType, FilterDropdownProps } from "antd/es/table/interface";
import Highlighter from "react-highlight-words";
import LineageViewer from "../LineageViewer/LineageViewer";

export interface MetadataEditorFormProps {
  table?: DBMetaDataContainer;
  relations?: DBMetaRelationship[];
  selectedCatalog?: string;
  selectedSchema?: string;
  onTableDescriptionChange: (description: string) => void;
  onPrimaryKeyChange: (primaryKey: string) => void;
  onColumnDescriptionChange: (column: string, description: string) => void;
  onRelationDelete: (relationId: string) => void;
  onRelationAdd: (relation: DBMetaRelationship) => void;
  onUseWithAIChanged: (useWithAI: boolean) => void;
}

export default function MetadataEditorForm({
  table,
  relations,
  selectedCatalog,
  selectedSchema,
  onTableDescriptionChange,
  onPrimaryKeyChange,
  onColumnDescriptionChange,
  onRelationDelete,
  onRelationAdd,
  onUseWithAIChanged,
}: MetadataEditorFormProps) {
  const [deleteRelations] = useDeleteRelationMutation();
  const [addRelation] = useAddRelationMutation();
  const [isDeletingRelation, setIsDeletingRelations] = useState<
    string | undefined
  >(undefined);

  const [isAddingRelation, setIsAddingRelation] = useState(false);

  const [isAddRelationModalOpen, setIsAddRelationModalOpen] =
    useState<boolean>(false);
  const [isColumnLineageModalOpen, setIsColumnLineageModalOpen] =
    useState<boolean>(false);
  const [api, contextHolder] = notification.useNotification();

  const openNotification =
    (
      pauseOnHover: boolean,
      title: string,
      message: string,
      success: boolean = true
    ) =>
    () => {
      if (success) {
        api.success({
          message: title,
          description: message,
          showProgress: true,
          pauseOnHover,
        });
      } else {
        api.error({
          message: title,
          description: message,
          showProgress: true,
          pauseOnHover,
        });
      }
    };
  const [searchText, setSearchText] = useState("");
  const searchInput = useRef<InputRef>(null);
  const [selectedColumn, setSelectedColumn] = useState<
    DBMetaDataColumn | undefined
  >(undefined);

  const fieldsDataSource = table?.metadata?.columns
    ?.filter((column) =>
      searchText === "" ? true : column.columnName.includes(searchText)
    )
    .map((column) => {
      return {
        key: column.columnName,
        name: column.columnName,
        dataType: column.dataType,
        columnDescription: column.columnDescription,
      };
    });

  const handleSearch = (
    selectedKeys: string[],
    confirm: FilterDropdownProps["confirm"]
  ) => {
    confirm();
    setSearchText(selectedKeys[0]);
  };

  const handleReset = (clearFilters: () => void) => {
    clearFilters();
    setSearchText("");
  };

  const fieldColumns: unknown[] = [
    {
      title: "Column Name",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      filterDropdown: ({
        setSelectedKeys,
        selectedKeys,
        confirm,
        clearFilters,
        close,
      }: FilterDropdownProps) => (
        <div style={{ padding: 8 }} onKeyDown={(e) => e.stopPropagation()}>
          <Input
            ref={searchInput}
            placeholder={`Search Column Name`}
            value={selectedKeys[0]}
            onChange={(e) =>
              setSelectedKeys(e.target.value ? [e.target.value] : [])
            }
            onPressEnter={() => handleSearch(selectedKeys as string[], confirm)}
            style={{ marginBottom: 8, display: "block" }}
          />
          <Space>
            <Button
              type="primary"
              onClick={() => handleSearch(selectedKeys as string[], confirm)}
              icon={<SearchOutlined />}
              size="small"
              style={{ width: 90 }}
            >
              Search
            </Button>
            <Button
              onClick={() => clearFilters && handleReset(clearFilters)}
              size="small"
              style={{ width: 90 }}
            >
              Reset
            </Button>

            <Button
              type="link"
              size="small"
              onClick={() => {
                close();
              }}
            >
              close
            </Button>
          </Space>
        </div>
      ),
      filterIcon: (filtered: boolean) => (
        <SearchOutlined style={{ color: filtered ? "#1677ff" : undefined }} />
      ),
      render: (text: string) => (
        <Highlighter
          highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
          searchWords={[searchText]}
          autoEscape
          textToHighlight={text ? text.toString() : ""}
        />
      ),
    },
    {
      title: "Data Type",
      dataIndex: "dataType",
      key: "dataType",
      ellipsis: true,
    },
    {
      title: "Description",
      dataIndex: "columnDescription",
      key: "columnDescription",
      ellipsis: true,
      render: (text: string, data: { key: string }) => (
        <Input
          placeholder="Column Description"
          value={text}
          onChange={(e) => {
            onColumnDescriptionChange(data.key, e.target.value);
          }}
          id={text}
        />
      ),
    },
  ];
  if (table?.metadata.catalogId === "2") {
    fieldColumns.push({
      title: "Lineage",
      key: "action",
      width: 90,
      render: (_: unknown, record: unknown) => {
        return (
          <Space size="middle">
            <Button
              icon={<ShareAltOutlined />}
              variant="solid"
              loading={isDeletingRelation === (record as { key: string }).key}
              disabled={
                isDeletingRelation === undefined
                  ? false
                  : isDeletingRelation !== (record as { key: string }).key
              }
              onClick={() => {
                if (table) {
                  const column = table.metadata.columns?.find(
                    (column) =>
                      column.columnName === (record as { key: string }).key
                  );
                  setSelectedColumn(column);
                  setIsColumnLineageModalOpen(true);
                }
              }}
            />
          </Space>
        );
      },
    });
  }

  const relationsDataSource = relations?.map((relation) => {
    return {
      key: relation.id,
      projectId: relation.projectId,
      source: `${relation.sourceCatalogName}.${relation.sourceSchemaName}.${relation.sourceTableName}.${relation.sourceColumnName}`,
      target: `${relation.targetCatalogName}.${relation.targetSchemaName}.${relation.targetTableName}.${relation.targetColumnName}`,
      sourceCatalogId: relation.sourceCatalogId,
      targetCatalogId: relation.targetCatalogId,
      type: relation.type,
    };
  });

  const relationsColumns = [
    {
      title: "From",
      dataIndex: "source",
      key: "source",
      ellipsis: true,
    },
    {
      title: "To",
      dataIndex: "target",
      key: "target",
      ellipsis: true,
    },
    {
      title: "Type",
      dataIndex: "type",
      key: "type",
      ellipsis: true,
    },
    {
      dataIndex: "projectId",
      key: "projectId",
      hidden: true,
    },
    {
      dataIndex: "sourceCatalogId",
      key: "sourceCatalogId",
      hidden: true,
    },
    {
      dataIndex: "targetCatalogId",
      key: "targetCatalogId",
      hidden: true,
    },
    {
      title: "Action",
      key: "action",
      render: (_: unknown, record: unknown) => {
        return (
          <Space size="middle">
            <Button
              color="danger"
              variant="solid"
              loading={isDeletingRelation === (record as { key: string }).key}
              disabled={
                isDeletingRelation === undefined
                  ? false
                  : isDeletingRelation !== (record as { key: string }).key
              }
              onClick={async () => {
                const relation = record as {
                  key: string;
                  projectId: string;
                  source: string;
                  sourceCatalogId: string;
                };
                setIsDeletingRelations(relation.key);
                try {
                  await deleteRelations({
                    projectId: relation.projectId,
                    catalogId: relation.sourceCatalogId,
                    schemaName: relation.source.split(".")[1],
                    tableName: relation.source.split(".")[2],
                    relationId: relation.key,
                  }).unwrap();

                  openNotification(
                    true,
                    "Success",
                    "Relation has been deletes successfully."
                  )();
                } catch (error) {
                  openNotification(
                    true,
                    "Fail",
                    (error as { data: { message: string } }).data.message,
                    false
                  )();
                }

                onRelationDelete(relation.key);
                setIsDeletingRelations(undefined);
              }}
            >
              Delete
            </Button>
          </Space>
        );
      },
    },
  ];

  const tableName = `${table?.metadata.catalogQueryName}.${table?.metadata.schemaName}.${table?.metadata.tableName}`;

  const primaryKeysOptions = useMemo(() => {
    if (!table?.metadata.columns) {
      return [];
    }
    return table.metadata.columns.map((column) => {
      return {
        value: column.columnName,
        label: column.columnName,
      };
    });
  }, [table?.metadata.columns]);

  const [selectedPrimaryKey, setSelectedPrimaryKey] = useState<
    string | undefined
  >();

  useEffect(() => {
    const primaryKey = table?.metadata.columns?.find(
      (column) => column.isPrimary
    );
    if (primaryKey) {
      setSelectedPrimaryKey(primaryKey.columnName);
    } else {
      setSelectedPrimaryKey(undefined);
    }
  }, [table?.metadata.columns]);

  return (
    <>
      {contextHolder}

      <Flex gap="middle" vertical>
        <Flex gap="small" justify="space-between">
          <Flex gap="small" vertical>
            <div className="text-gray-500">Name</div>
            <Text ellipsis title={tableName}>
              {tableName}
            </Text>
          </Flex>
          <Flex gap="small" vertical>
            <div className="text-gray-500">Use with AI</div>
            <Switch
              className="w-8"
              value={table?.metadata.useWithAI}
              onChange={onUseWithAIChanged}
            />
          </Flex>
        </Flex>

        <Flex gap="small" vertical>
          <div className="text-gray-500">Description</div>
          <Input
            placeholder="Table Description"
            value={table?.metadata.tableDescription}
            onChange={(e) => onTableDescriptionChange(e.target.value)}
          />
        </Flex>
        <Flex gap="small" vertical>
          <div className="text-gray-500">Primary Key</div>
          <Select
            showSearch
            placeholder="Select Primary Key"
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            value={selectedPrimaryKey}
            options={primaryKeysOptions}
            onChange={(value) => {
              onPrimaryKeyChange(value);
            }}
          />
        </Flex>
        <Flex gap="small" vertical>
          <div className="text-gray-500">Columns</div>
          <Table
            dataSource={fieldsDataSource}
            columns={fieldColumns as ColumnsType}
            pagination={{
              pageSize: 7,
              hideOnSinglePage: true,

              showSizeChanger: false,
              size: "small",
            }}
          />
        </Flex>
        <Flex gap="small" vertical>
          <Flex gap="small" justify="space-between">
            <div className="text-gray-500">Relations</div>
            <Button
              type="primary"
              onClick={() => {
                setIsAddRelationModalOpen(true);
              }}
            >
              Add Relation
            </Button>
          </Flex>
          <Table
            dataSource={relationsDataSource}
            columns={relationsColumns}
            pagination={{ pageSize: 2, hideOnSinglePage: true, size: "small" }}
          />
        </Flex>
        <Modal
          title="Add Relation"
          open={isAddRelationModalOpen}
          width={750}
          centered
          maskClosable={false}
          destroyOnClose
          footer={null}
          onCancel={() => {
            setIsAddRelationModalOpen(false);
          }}
        >
          <AddRelationForm
            projectId={table?.metadata?.projectId}
            selectedCatalog={selectedCatalog}
            selectedSchema={selectedSchema}
            initialSelectedModel={`${table?.metadata.projectId}.${table?.metadata.catalogId}.${table?.metadata.schemaName}.${table?.metadata.tableName}`}
            onSubmit={async (values: FormValues) => {
              const fromSplit = values.from.split(".");
              const toSplit = values.to.split(".");
              setIsAddingRelation(true);
              try {
                const relation = await addRelation({
                  projectId: table?.metadata.projectId
                    ? table?.metadata.projectId
                    : "",
                  sourceCatalogId: fromSplit[1],
                  sourceSchemaName: fromSplit[2],
                  sourceTableName: fromSplit[3],
                  sourceColumnName: fromSplit[4],
                  targetCatalogId: toSplit[1],
                  targetSchemaName: toSplit[2],
                  targetTableName: toSplit[3],
                  targetColumnName: toSplit[4],
                  type: getRelationType(values.type),
                }).unwrap();

                onRelationAdd(relation);
                setIsAddingRelation(false);
                setIsAddRelationModalOpen(false);

                openNotification(
                  true,
                  "Success",
                  "Relation has been added successfully."
                )();
              } catch (error) {
                setIsAddingRelation(false);
                openNotification(
                  true,
                  "Fail",
                  (error as { data: { message: string } }).data.message,
                  false
                )();
              }
            }}
            isAddingRelation={isAddingRelation}
          />
        </Modal>

        <Modal
          title="Column Lineage"
          open={isColumnLineageModalOpen}
          width={1000}
          centered
          maskClosable={false}
          destroyOnClose
          footer={null}
          onCancel={() => {
            setIsColumnLineageModalOpen(false);
          }}
        >
          <LineageViewer data={selectedColumn?.lineage} />
        </Modal>
      </Flex>
    </>
  );
}
